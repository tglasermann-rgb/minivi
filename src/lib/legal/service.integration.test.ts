import { beforeAll, describe, expect, it, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => ({ id: "00000000-0000-0000-0000-000000000001", email: "test@minivi.test", fullName: null, role: "owner" }) }));
// Storage real necesita Supabase; acá solo interesa la lógica y la base.
vi.mock("@/lib/storage", () => ({
  uploadToBucket: async () => "stored",
  signedUrl: async (_b: string, p: string) => `https://firmado/${p}`,
  supabaseAdmin: () => ({ storage: { from: () => ({ remove: async () => ({ error: null }) }) } }),
  ensureBucket: async () => {},
}));
vi.mock("@/lib/prisma", async () => {
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("@/generated/prisma/client");
  return { prisma: new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL ?? "" }) }) };
});

const day = (offset: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};

describe.skipIf(!url)("legal (integración)", () => {
  let svc: typeof import("./service");
  let prisma: typeof import("@/lib/prisma").prisma;

  beforeAll(async () => {
    svc = await import("./service");
    prisma = (await import("@/lib/prisma")).prisma;
    await prisma.legalFile.deleteMany();
    await prisma.legalDocument.deleteMany();
  });

  it("guarda un documento con archivo y lo lista", async () => {
    const doc = await svc.saveDocument(null, {
      title: "Contrato de alquiler 123 NE 125th St", category: "lease", status: "active", counterparty: "Propietario SA",
      reference: "LEASE-2026", effectiveOn: day(-30), expiresOn: day(400), noticeDays: 90, amountCents: 240000, notes: "Renovación automática salvo aviso.",
    }, [{ bytes: Buffer.from("PDF de prueba"), name: "contrato.pdf", contentType: "application/pdf" }]);

    const full = await svc.getDocument(doc.id);
    expect(full?.title).toContain("Contrato de alquiler");
    expect(full?.files).toHaveLength(1);
    expect(full?.files[0].url).toContain("firmado");
    expect(full?.amountCents).toBe(240000);
    // 400 días con aviso de 90: todavía vigente.
    expect(full?.state).toBe("vigente");

    const { rows, totals } = await svc.listDocuments();
    expect(rows).toHaveLength(1);
    expect(rows[0].files).toBe(1);
    expect(totals.sinArchivo).toBe(0);
  });

  it("marca por vencer y vencido según el aviso previo de cada documento", async () => {
    await svc.saveDocument(null, { title: "Póliza de joyería", category: "insurance", status: "active", noticeDays: 30, amountCents: 0, expiresOn: day(20) });
    await svc.saveDocument(null, { title: "Licencia de negocio", category: "license", status: "active", noticeDays: 30, amountCents: 0, expiresOn: day(-5) });
    await svc.saveDocument(null, { title: "Operating Agreement", category: "company", status: "active", noticeDays: 30, amountCents: 0, expiresOn: null });

    const { rows, totals } = await svc.listDocuments();
    const byTitle = (t: string) => rows.find((r) => r.title === t)!;
    expect(byTitle("Póliza de joyería").state).toBe("por_vencer");
    expect(byTitle("Licencia de negocio").state).toBe("vencido");
    expect(byTitle("Operating Agreement").state).toBe("sin_vencimiento");
    expect(totals.porVencer).toBe(1);
    expect(totals.vencidos).toBe(1);
    expect(totals.sinArchivo).toBe(3);

    // El aviso de Inicio trae los que urgen, primero el más próximo.
    const urgentes = await svc.expiringDocuments();
    expect(urgentes.map((x) => x.title)).toEqual(["Licencia de negocio", "Póliza de joyería"]);
  });

  it("filtra por categoría, estado, texto y vencimiento", async () => {
    expect((await svc.listDocuments({ category: "insurance" })).rows).toHaveLength(1);
    expect((await svc.listDocuments({ q: "joyería" })).rows).toHaveLength(1);
    expect((await svc.listDocuments({ q: "125th" })).rows).toHaveLength(1); // busca en el título
    expect((await svc.listDocuments({ expiry: "vencido" })).rows).toHaveLength(1);
    expect((await svc.listDocuments({ status: "draft" })).rows).toHaveLength(0);
  });

  it("terminar conserva el documento y sus archivos, y deja de avisar", async () => {
    const doc = await prisma.legalDocument.findFirstOrThrow({ where: { title: "Licencia de negocio" } });
    await svc.terminateDocument(doc.id);
    const after = await svc.getDocument(doc.id);
    expect(after?.status).toBe("terminated");
    expect(after?.state).toBe("sin_vencimiento");
    expect(await prisma.legalDocument.count()).toBe(4);
    expect((await svc.expiringDocuments()).map((x) => x.title)).toEqual(["Póliza de joyería"]);
  });

  it("borrar un archivo no borra el documento", async () => {
    const doc = await prisma.legalDocument.findFirstOrThrow({ where: { title: { contains: "alquiler" } }, include: { files: true } });
    await svc.deleteFile(doc.files[0].id);
    const after = await svc.getDocument(doc.id);
    expect(after).not.toBeNull();
    expect(after?.files).toHaveLength(0);
  });

  it("rechaza archivos de más de 25 MB", async () => {
    const doc = await prisma.legalDocument.findFirstOrThrow();
    await expect(svc.attachFile(doc.id, { bytes: Buffer.alloc(svc.MAX_FILE_BYTES + 1), name: "enorme.pdf", contentType: "application/pdf" })).rejects.toThrow(/25 MB/);
  });
});
