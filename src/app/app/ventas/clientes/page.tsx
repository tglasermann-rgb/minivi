import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/money";

export const metadata = { title: "Clientes" };
export const dynamic = "force-dynamic";

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const rows = await prisma.customer.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } : {},
    orderBy: { totalSpentCents: "desc" },
    take: 300,
  });
  return (
    <>
      <div className="mb-2"><Link href="/app/ventas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4" /> Ventas</Link></div>
      <PageHeader eyebrow="Ventas" title="Clientes" description="Lo que trae Shopify. Para email marketing usá Shopify Email o Klaviyo." />
      <form className="mb-3"><input name="q" defaultValue={q ?? ""} placeholder="Buscar por nombre, email o teléfono" className="h-9 w-72 rounded-md border border-input bg-card px-3 text-sm" /></form>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Email</TableHead><TableHead>Teléfono</TableHead><TableHead className="text-right">Compras</TableHead><TableHead className="text-right">Total gastado</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Sin clientes todavía.</TableCell></TableRow>}
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.name ?? "—"}</TableCell>
                <TableCell className="text-xs">{c.email ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{c.phone ?? "—"}</TableCell>
                <TableCell className="text-right font-mono text-xs">{c.ordersCount}</TableCell>
                <TableCell className="text-right font-mono text-xs">{formatCents(c.totalSpentCents)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
