import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function fmt(v: unknown): string {
  if (v && typeof v === "object" && "value" in v) return String((v as { value: unknown }).value);
  return v == null ? "—" : JSON.stringify(v);
}

const dateFmt = new Intl.DateTimeFormat("es-US", { dateStyle: "short", timeStyle: "short", timeZone: "America/New_York" });

/** Últimos cambios de una entidad, leídos de audit_log. */
export async function AuditRecent({ entity, limit = 10 }: { entity: string; limit?: number }) {
  const rows = await prisma.auditLog.findMany({ where: { entity }, orderBy: { createdAt: "desc" }, take: limit });
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Historial de cambios</CardTitle>
        <CardDescription>Últimos {limit} cambios en {entity}.</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay cambios registrados.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuándo</TableHead>
                <TableHead>Quién</TableHead>
                <TableHead>Clave</TableHead>
                <TableHead>Antes</TableHead>
                <TableHead>Después</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={String(r.id)}>
                  <TableCell className="font-mono text-xs">{dateFmt.format(r.createdAt)}</TableCell>
                  <TableCell className="text-xs">{r.userEmail ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.entityId}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{fmt(r.before)}</TableCell>
                  <TableCell className="font-mono text-xs">{fmt(r.after)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
