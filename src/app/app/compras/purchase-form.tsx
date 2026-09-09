"use client";
import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KARATS, PRODUCT_TYPES, SUBCATEGORIES, SUBCATEGORIES_BY_TYPE, TYPE_LABELS } from "@/lib/inventory/constants";
import { computeCostCents } from "@/lib/inventory/pricing";
import { buildInstallments, TERMS_LABELS, type PaymentTerms } from "@/lib/purchases/terms";
import { formatCents } from "@/lib/money";
import { purchaseFormSchema, type PurchaseFormInput, type PurchaseFormValues } from "./schema";
import { createPurchaseAction, updatePurchaseAction } from "./actions";
import type { ProductType } from "@/generated/prisma/client";

type Supplier = { id: string; name: string; paymentTerms: string | null };
const selectCls = "h-9 w-full rounded-md border border-input bg-card px-2 text-sm";
const dateFmt = new Intl.DateTimeFormat("es-US", { dateStyle: "medium", timeZone: "UTC" });

const emptyLine = (): PurchaseFormInput["items"][number] => ({ description: "", type: "necklace", subcategory: "chains", karat: "14k", grams: undefined as unknown as number, qty: 1, unitCost: undefined, optionName: "", optionValue: "" });

export function PurchaseForm({ suppliers, defaultCostPerGram, purchaseId, defaultValues }: { suppliers: Supplier[]; defaultCostPerGram: number; purchaseId?: string; defaultValues?: Partial<PurchaseFormInput> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<PurchaseFormInput, unknown, PurchaseFormValues>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: {
      supplierId: suppliers[0]?.id ?? "",
      date: new Date().toISOString().slice(0, 10),
      invoiceNumber: "",
      costPerGram: defaultCostPerGram,
      tax: 0,
      shipping: 0,
      paymentTerms: "30_60_90",
      customInstallments: [],
      notes: "",
      items: [emptyLine()],
      ...defaultValues,
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const custom = useFieldArray({ control: form.control, name: "customInstallments" });
  const w = form.watch();
  const cpg = Math.round((Number(w.costPerGram) || 0) * 100);

  const lineTotals = useMemo(() => (w.items ?? []).map((l) => {
    const unit = l?.unitCost != null && l.unitCost !== ("" as unknown) && !Number.isNaN(Number(l.unitCost)) && String(l.unitCost) !== "" ? Math.round(Number(l.unitCost) * 100) : computeCostCents(Number(l?.grams) || 0, cpg);
    return { unit, total: unit * (Number(l?.qty) || 0) };
  }), [w.items, cpg]);
  const subtotal = lineTotals.reduce((s, l) => s + l.total, 0);
  const total = subtotal + Math.round((Number(w.tax) || 0) * 100) + Math.round((Number(w.shipping) || 0) * 100);
  const preview = useMemo(() => {
    try {
      if (w.paymentTerms === "custom") return [];
      return buildInstallments(total, (w.paymentTerms ?? "contado") as PaymentTerms, new Date(`${w.date}T00:00:00Z`));
    } catch { return []; }
  }, [total, w.paymentTerms, w.date]);
  const totalGrams = (w.items ?? []).reduce((s, l) => s + (Number(l?.grams) || 0) * (Number(l?.qty) || 0), 0);

  function onSubmit(values: PurchaseFormValues) {
    start(async () => {
      const r = purchaseId ? await updatePurchaseAction(purchaseId, values) : await createPurchaseAction(values);
      if (r.ok) {
        toast.success(r.message ?? "Guardado");
        if (!purchaseId && r.data) router.push(`/app/compras/${r.data.id}`);
        else router.refresh();
      } else {
        toast.error(r.error);
        for (const [k, m] of Object.entries(r.fieldErrors ?? {})) form.setError(k as keyof PurchaseFormInput, { message: m?.[0] });
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
        <Card>
          <CardHeader><CardTitle>Cabecera</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FormField control={form.control} name="supplierId" render={({ field }) => (
              <FormItem>
                <FormLabel>Proveedor</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Elegí" /></SelectTrigger></FormControl>
                  <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="date" render={({ field }) => (
              <FormItem><FormLabel>Fecha</FormLabel><FormControl><Input type="date" className="font-mono" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="invoiceNumber" render={({ field }) => (
              <FormItem><FormLabel>Nº de factura / referencia</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="costPerGram" render={({ field }) => (
              <FormItem>
                <FormLabel>Costo por gramo (USD)</FormLabel>
                <FormControl><Input type="number" step="0.01" min="0" className="font-mono" {...field} /></FormControl>
                <FormDescription>Se aplica a todas las líneas salvo costo manual.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Líneas</CardTitle>
            <CardDescription>Cada línea se convierte en un producto (SKU) al recibirla. Descripción en inglés: es el título del producto.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="hidden grid-cols-[1fr_110px_120px_64px_80px_60px_90px_70px_90px_32px] gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground lg:grid">
              <span>Descripción</span><span>Tipo</span><span>Subcategoría</span><span>Kilat.</span><span>Gramos</span><span>Cant.</span><span>Costo unit.</span><span>Opción</span><span className="text-right">Total</span><span />
            </div>
            {fields.map((f, i) => {
              const type = (w.items?.[i]?.type ?? "necklace") as ProductType;
              const subcats = [...SUBCATEGORIES_BY_TYPE[type], ...SUBCATEGORIES.filter((s) => !SUBCATEGORIES_BY_TYPE[type].includes(s))];
              return (
                <div key={f.id} className="grid gap-2 rounded-md border p-2 lg:grid-cols-[1fr_110px_120px_64px_80px_60px_90px_70px_90px_32px] lg:items-start lg:border-0 lg:p-0">
                  <FormField control={form.control} name={`items.${i}.description`} render={({ field }) => (
                    <FormItem><FormControl><Input placeholder="Cuban Link Chain 3mm" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name={`items.${i}.type`} render={({ field }) => (
                    <FormItem><FormControl><select className={selectCls} {...field}>{PRODUCT_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}</select></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name={`items.${i}.subcategory`} render={({ field }) => (
                    <FormItem><FormControl><select className={selectCls} {...field}>{subcats.map((s) => <option key={s} value={s}>{s}</option>)}</select></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name={`items.${i}.karat`} render={({ field }) => (
                    <FormItem><FormControl><select className={selectCls} {...field}>{KARATS.map((k) => <option key={k} value={k}>{k}</option>)}</select></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name={`items.${i}.grams`} render={({ field }) => (
                    <FormItem><FormControl><Input type="number" step="0.01" min="0" placeholder="g" className="font-mono" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name={`items.${i}.qty`} render={({ field }) => (
                    <FormItem><FormControl><Input type="number" step="1" min="1" className="font-mono" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name={`items.${i}.unitCost`} render={({ field }) => (
                    <FormItem><FormControl><Input type="number" step="0.01" min="0" placeholder={formatCents(lineTotals[i]?.unit ?? 0)} className="font-mono" {...field} value={field.value ?? ""} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name={`items.${i}.optionValue`} render={({ field }) => (
                    <FormItem><FormControl><Input placeholder={type === "ring" ? "talla" : "largo"} className="font-mono" {...field} /></FormControl></FormItem>
                  )} />
                  <div className="pt-2 text-right font-mono text-sm">{formatCents(lineTotals[i]?.total ?? 0)}</div>
                  <Button type="button" variant="ghost" size="icon" aria-label="Quitar línea" onClick={() => remove(i)} disabled={fields.length === 1}><Trash2Icon /></Button>
                </div>
              );
            })}
            <div>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ ...emptyLine(), type: w.items?.at(-1)?.type ?? "necklace", subcategory: w.items?.at(-1)?.subcategory ?? "chains" })}><PlusIcon /> Agregar línea</Button>
            </div>
            {form.formState.errors.items?.root && <p className="text-sm text-destructive">{form.formState.errors.items.root.message}</p>}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Totales</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="tax" render={({ field }) => (
                  <FormItem><FormLabel>Impuestos (USD)</FormLabel><FormControl><Input type="number" step="0.01" min="0" className="font-mono" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="shipping" render={({ field }) => (
                  <FormItem><FormLabel>Envío (USD)</FormLabel><FormControl><Input type="number" step="0.01" min="0" className="font-mono" {...field} /></FormControl></FormItem>
                )} />
              </div>
              <dl className="grid grid-cols-2 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Gramos totales</dt><dd className="text-right font-mono">{totalGrams.toFixed(2)} g</dd>
                <dt className="text-muted-foreground">Subtotal</dt><dd className="text-right font-mono">{formatCents(subtotal)}</dd>
                <dt className="font-medium">Total</dt><dd className="text-right font-mono text-lg">{formatCents(total)}</dd>
                {totalGrams > 0 && <><dt className="text-muted-foreground">Costo real por gramo (con impuestos y envío)</dt><dd className="text-right font-mono">{formatCents(Math.round(total / totalGrams))}/g</dd></>}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Condiciones de pago</CardTitle><CardDescription>Se generan las cuentas por pagar automáticamente.</CardDescription></CardHeader>
            <CardContent className="grid gap-3">
              <FormField control={form.control} name="paymentTerms" render={({ field }) => (
                <FormItem>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{Object.entries(TERMS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
              {w.paymentTerms === "custom" ? (
                <div className="grid gap-2">
                  {custom.fields.map((f, i) => (
                    <div key={f.id} className="grid grid-cols-[1fr_1fr_32px] gap-2">
                      <FormField control={form.control} name={`customInstallments.${i}.amount`} render={({ field }) => (<FormItem><FormControl><Input type="number" step="0.01" placeholder="Monto" className="font-mono" {...field} /></FormControl></FormItem>)} />
                      <FormField control={form.control} name={`customInstallments.${i}.dueOn`} render={({ field }) => (<FormItem><FormControl><Input type="date" className="font-mono" {...field} /></FormControl></FormItem>)} />
                      <Button type="button" variant="ghost" size="icon" onClick={() => custom.remove(i)}><Trash2Icon /></Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => custom.append({ amount: 0, dueOn: w.date ?? "" })}><PlusIcon /> Cuota</Button>
                  <p className="text-xs text-muted-foreground">Las cuotas tienen que sumar exactamente el total.</p>
                </div>
              ) : (
                <ul className="text-sm">
                  {preview.map((c, i) => <li key={i} className="flex justify-between border-b py-1 last:border-0"><span className="font-mono text-xs text-muted-foreground">{dateFmt.format(c.dueOn)}</span><span className="font-mono">{formatCents(c.amountCents)}</span></li>)}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem><FormLabel>Notas (van al PDF)</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl></FormItem>
        )} />

        <div className="flex justify-end">
          <Button type="submit" variant="gold" size="lg" disabled={pending}>{pending ? "Guardando…" : purchaseId ? "Guardar cambios" : "Crear compra"}</Button>
        </div>
      </form>
    </Form>
  );
}
