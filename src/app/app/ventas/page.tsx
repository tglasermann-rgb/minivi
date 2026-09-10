import Link from "next/link";
import { ShieldCheckIcon, UsersIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Stat } from "@/components/ui/stat";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WeeklyMetric } from "@/components/sales/weekly-metric";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/money";
import { TYPE_LABELS } from "@/lib/inventory/constants";
import { CHANNEL_LABELS } from "@/lib/sales/channel";
import { ranges, summarize, type Summary } from "@/lib/sales/stats";
import { lastSyncAt } from "@/lib/sales/sync";
import { shopifyConfigured } from "@/lib/shopify/client";
import { SyncButton } from "./sync-button";
import type { ProductType } from "@/generated/prisma/client";

export const metadata = { title: "Ventas" };
export const dynamic = "force-dynamic";

function SummaryView({ s }: { s: Summary }) {
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Stat label="Ventas netas" value={formatCents(s.netCents)} hint={s.refundedCents ? `${formatCents(s.refundedCents)} devuelto` : undefined} />
        <Stat label="Órdenes" value={String(s.orders)} />
        <Stat label="Piezas" value={String(s.units)} />
        <Stat label="Ticket promedio" value={formatCents(s.avgTicketCents)} />
        <Stat label="Gramos vendidos" value={`${s.grams.toFixed(2)} g`} />
        <Stat label="Margen bruto" value={formatCents(s.marginCents)} hint={s.netCents ? `${Math.round((s.marginCents / s.netCents) * 100)}% de la venta` : undefined} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Por canal</CardTitle></CardHeader>
          <CardContent>{s.byChannel.length === 0 ? <p className="text-sm text-muted-foreground">Sin ventas.</p> : <ul className="grid gap-1 text-sm">{s.byChannel.map((c) => <li key={c.channel} className="flex justify-between border-b py-1 last:border-0"><span>{CHANNEL_LABELS[c.channel]} <span className="text-muted-foreground">· {c.orders}</span></span><span className="font-mono">{formatCents(c.netCents)}</span></li>)}</ul>}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Por vendedora</CardTitle><CardDescription>Staff del POS de Shopify.</CardDescription></CardHeader>
          <CardContent>{s.byStaff.length === 0 ? <p className="text-sm text-muted-foreground">Sin ventas.</p> : <ul className="grid gap-1 text-sm">{s.byStaff.map((c) => <li key={c.staff} className="flex justify-between border-b py-1 last:border-0"><span>{c.staff} <span className="text-muted-foreground">· {c.orders}</span></span><span className="font-mono">{formatCents(c.netCents)}</span></li>)}</ul>}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Por tipo de producto</CardTitle></CardHeader>
          <CardContent>{s.byType.length === 0 ? <p className="text-sm text-muted-foreground">Sin ventas.</p> : <ul className="grid gap-1 text-sm">{s.byType.map((c) => <li key={c.type} className="flex justify-between border-b py-1 last:border-0"><span>{TYPE_LABELS[c.type as ProductType] ?? c.type} <span className="text-muted-foreground">· {c.units} pz</span></span><span className="font-mono">{formatCents(c.netCents)}</span></li>)}</ul>}</CardContent>
        </Card>
      </div>
    </div>
  );
}

export default async function VentasPage() {
  const r = await ranges();
  const [today, week, month, last, failed, recent] = await Promise.all([
    summarize(r.today), summarize(r.week), summarize(r.month), lastSyncAt(),
    prisma.webhookEvent.count({ where: { processedAt: null } }),
    prisma.order.findMany({ include: { items: { select: { qty: true, refundedQty: true } } }, orderBy: { placedAt: "desc" }, take: 25 }),
  ]);
  const dt = new Intl.DateTimeFormat("es-US", { dateStyle: "short", timeStyle: "short", timeZone: r.tz });

  return (
    <>
      <PageHeader
        eyebrow="Ventas"
        title="Ventas"
        description={shopifyConfigured() ? `Órdenes de Shopify (web, tienda y TikTok). Última sincronización: ${last ? dt.format(last) : "nunca"}. Los webhooks las traen en tiempo real.` : "Shopify no está configurado todavía: ver docs/SETUP-SHOPIFY.md."}
        actions={<><Button asChild variant="outline"><Link href="/app/ventas/garantias"><ShieldCheckIcon /> Garantías</Link></Button><Button asChild variant="outline"><Link href="/app/ventas/clientes"><UsersIcon /> Clientes</Link></Button><SyncButton failedWebhooks={failed} /></>}
      />
      <div className="mb-6"><WeeklyMetric /></div>
      <Tabs defaultValue="week">
        <TabsList>
          <TabsTrigger value="today">Hoy</TabsTrigger>
          <TabsTrigger value="week">Esta semana</TabsTrigger>
          <TabsTrigger value="month">Este mes</TabsTrigger>
        </TabsList>
        <TabsContent value="today" className="mt-4"><SummaryView s={today} /></TabsContent>
        <TabsContent value="week" className="mt-4"><SummaryView s={week} /></TabsContent>
        <TabsContent value="month" className="mt-4"><SummaryView s={month} /></TabsContent>
      </Tabs>

      <Card className="mt-6">
        <CardHeader><CardTitle>Últimas órdenes</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Orden</TableHead><TableHead>Fecha</TableHead><TableHead>Canal</TableHead><TableHead>Cliente</TableHead><TableHead>Vendedora</TableHead><TableHead className="text-right">Piezas</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
            <TableBody>
              {recent.length === 0 && <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Sin órdenes todavía. Apretá &quot;Sincronizar&quot; cuando Shopify esté configurado.</TableCell></TableRow>}
              {recent.map((o) => (
                <TableRow key={o.id} className={o.cancelledAt ? "opacity-50" : ""}>
                  <TableCell className="font-mono text-xs">{o.orderNumber}</TableCell>
                  <TableCell className="font-mono text-xs">{dt.format(o.placedAt)}</TableCell>
                  <TableCell><Badge variant={o.channel === "pos" ? "gold" : o.channel === "tiktok" ? "secondary" : "outline"}>{CHANNEL_LABELS[o.channel]}</Badge></TableCell>
                  <TableCell className="text-xs">{o.customerName ?? "—"}</TableCell>
                  <TableCell className="text-xs">{o.staffName ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{o.items.reduce((a, i) => a + i.qty - i.refundedQty, 0)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatCents(o.totalCents - o.refundedCents)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{o.cancelledAt ? "cancelada" : (o.financialStatus ?? "").toLowerCase()}{o.refundedCents ? " · devolución" : ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
