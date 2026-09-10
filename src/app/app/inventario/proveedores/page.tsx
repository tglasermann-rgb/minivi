import { PageHeader } from "@/components/layout/page-header";
import { InventarioNav } from "../section-nav";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { listSuppliers } from "../entradas/queries";
import { SupplierDialog } from "./supplier-dialog";

export const metadata = { title: "Proveedores" };
export const dynamic = "force-dynamic";

export default async function ProveedoresPage() {
  const rows = await listSuppliers(false);
  return (
    <>
      <InventarioNav />
      <PageHeader eyebrow="Compras" title="Proveedores" actions={<SupplierDialog />} />
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Contacto</TableHead><TableHead>Términos</TableHead><TableHead>Estado</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Sin proveedores. Agregá el primero.</TableCell></TableRow>}
            {rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{s.contact ?? "—"}</TableCell>
                <TableCell className="text-xs">{s.paymentTerms ?? "—"}</TableCell>
                <TableCell><Badge variant={s.active ? "success" : "outline"}>{s.active ? "activo" : "inactivo"}</Badge></TableCell>
                <TableCell className="text-right"><SupplierDialog supplier={{ id: s.id, name: s.name, contact: s.contact ?? "", paymentTerms: s.paymentTerms ?? "", notes: s.notes ?? "", active: s.active }} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
