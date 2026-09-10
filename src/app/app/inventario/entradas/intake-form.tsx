"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PackagePlusIcon, PlusIcon, RotateCwIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EXTRA_TAGS, KARATS, PRODUCT_TYPES, SUBCATEGORIES, SUBCATEGORIES_BY_TYPE, TYPE_LABELS } from "@/lib/inventory/constants";
import { computeCostCents, computePriceCents } from "@/lib/inventory/pricing";
import { formatCents } from "@/lib/money";
import { PREMIUM_PRESETS } from "./constants";
import { DEFAULT_DESCRIPTION, intakeFormSchema, type IntakeFormInput, type IntakeFormValues } from "./schema";
import { registerIntakeAction, searchProductsAction } from "./actions";
import type { ProductType } from "@/generated/prisma/client";

type Supplier = { id: string; name: string };
type Found = { id: string; sku: string; title: string; grams: number; costCents: number; priceCents: number; priceOverride: boolean; optionValue: string | null };

const selectCls = "h-9 w-full rounded-md border border-input bg-card px-2 text-sm";
const dateFmt = new Intl.DateTimeFormat("es-US", { dateStyle: "medium", timeZone: "UTC" });
const hoy = () => new Date().toISOString().slice(0, 10);

const emptyLine = (): IntakeFormInput["lines"][number] => ({
  mode: "new", productId: "", updateExisting: true,
  title: "", type: "necklace", subcategory: "chains", extraTags: ["new"], karat: "14k",
  grams: undefined as unknown as number, descriptionHtml: DEFAULT_DESCRIPTION,
  optionName: "", optionValue: "", priceOverride: false, price: undefined, status: "draft",
  qty: 1, premium: 0, unitCost: undefined,
});

/**
 * Entrada de mercadería: la factura del proveedor y el alta en inventario en
 * una sola pantalla. Cada pieza es nueva o repone una que ya está en stock.
 */
export function IntakeForm({ suppliers, defaultCostPerGram, pricePerGramCents, roundingCents }: {
  suppliers: Supplier[];
  defaultCostPerGram: number;
  pricePerGramCents: number;
  roundingCents: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // Piezas ya buscadas, guardadas por id de producto. Por número de fila no
  // sirve: al borrar una fila los índices se corren y los datos se desalinean.
  const [catalog, setCatalog] = useState<Record<string, Found>>({});

  const form = useForm<IntakeFormInput, unknown, IntakeFormValues>({
    resolver: zodResolver(intakeFormSchema),
    defaultValues: {
      supplierId: suppliers[0]?.id ?? "",
      date: hoy(),
      invoiceNumber: "",
      costPerGram: defaultCostPerGram,
      tax: 0,
      shipping: 0,
      payments: [{ amount: 0, dueOn: hoy() }],
      notes: "",
      lines: [emptyLine()],
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });
  const pagos = useFieldArray({ control: form.control, name: "payments" });
  const w = form.watch();
  const base = Math.round((Number(w.costPerGram) || 0) * 100);

  // Sin useMemo: react-hook-form muta el array en el lugar y un memo se queda
  // con los valores de la fila anterior. Son cuatro cuentas por pieza.
  const totals = (w.lines ?? []).map((l) => {
    const esReposicion = l?.mode === "restock";
    const p = l?.productId ? catalog[l.productId] : undefined;
    const grams = esReposicion ? (p?.grams ?? 0) : Number(l?.grams) || 0;
    const perGram = base + Math.max(0, Math.round((Number(l?.premium) || 0) * 100));
    const manual = l?.unitCost != null && String(l.unitCost) !== "" && !Number.isNaN(Number(l.unitCost));
    const unit = manual ? Math.round(Number(l.unitCost) * 100) : computeCostCents(grams, perGram);
    const qty = Number(l?.qty) || 0;
    const precio = grams > 0 ? computePriceCents(grams, pricePerGramCents, roundingCents) : 0;
    return { grams, perGram, manual, unit, qty, total: unit * qty, precio };
  });

  const subtotal = totals.reduce((s, l) => s + l.total, 0);
  const total = subtotal + Math.round((Number(w.tax) || 0) * 100) + Math.round((Number(w.shipping) || 0) * 100);
  const totalGramos = totals.reduce((s, l) => s + l.grams * l.qty, 0);
  const pagado = (w.payments ?? []).reduce((s, p) => s + Math.round((Number(p?.amount) || 0) * 100), 0);
  const pagosCuadran = pagado === total;

  // Una sola fecha de pago sigue el total sola: es el caso más común.
  const unaSolaFecha = (w.payments ?? []).length === 1;
  useEffect(() => {
    if (unaSolaFecha && Math.round((Number(w.payments?.[0]?.amount) || 0) * 100) !== total) {
      form.setValue("payments.0.amount", total / 100, { shouldDirty: false });
    }
  }, [total, unaSolaFecha, w.payments, form]);

  function setMode(i: number, mode: "new" | "restock") {
    form.setValue(`lines.${i}.mode`, mode);
    if (mode === "new") form.setValue(`lines.${i}.productId`, "");
  }

  function onSubmit(values: IntakeFormValues) {
    start(async () => {
      const r = await registerIntakeAction(values);
      if (r.ok) {
        toast.success(r.message ?? "Entrada guardada");
        router.push(`/app/inventario/entradas/${r.data!.id}`);
      } else {
        toast.error(r.error);
        for (const [k, m] of Object.entries(r.fieldErrors ?? {})) form.setError(k as keyof IntakeFormInput, { message: m?.[0] });
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Factura</CardTitle>
            <CardDescription>Los datos que te da el proveedor. El costo por gramo es la base; cada pieza le suma su &quot;+&quot;.</CardDescription>
          </CardHeader>
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
              <FormItem><FormLabel>Nº de factura</FormLabel><FormControl><Input placeholder="A-4471" {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="costPerGram" render={({ field }) => (
              <FormItem>
                <FormLabel>Costo por gramo (USD)</FormLabel>
                <FormControl><Input type="number" step="0.01" min="0" className="no-spinner font-mono" {...field} /></FormControl>
                <FormDescription>Es la base de esta factura.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Piezas</CardTitle>
            <CardDescription>
              Cada pieza entra al stock al guardar. Si es la primera vez que la tenés, se crea con SKU y precio;
              si ya la tenés, sumás unidades a la que existe.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {fields.map((f, i) => {
              const l = w.lines?.[i];
              const esReposicion = l?.mode === "restock";
              const type = (l?.type ?? "necklace") as ProductType;
              const subcats = [...SUBCATEGORIES_BY_TYPE[type], ...SUBCATEGORIES.filter((s) => !SUBCATEGORIES_BY_TYPE[type].includes(s))];
              const t = totals[i];
              const elegida = l?.productId ? catalog[l.productId] : undefined;

              return (
                <div key={f.id} className="rounded-lg border bg-card">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{i + 1}</span>
                      <div className="flex rounded-md border p-0.5">
                        <button type="button" onClick={() => setMode(i, "new")}
                          className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${!esReposicion ? "bg-oro text-white" : "text-muted-foreground"}`}>
                          <PackagePlusIcon className="size-3.5" /> Primera vez
                        </button>
                        <button type="button" onClick={() => setMode(i, "restock")}
                          className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${esReposicion ? "bg-oro text-white" : "text-muted-foreground"}`}>
                          <RotateCwIcon className="size-3.5" /> Reponer
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-mono text-sm">{formatCents(t?.total ?? 0)}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{t?.manual ? "costo cerrado" : `${formatCents(t?.perGram ?? 0)}/g`}</div>
                      </div>
                      <Button type="button" variant="ghost" size="icon" aria-label={`Quitar la pieza ${i + 1}`} onClick={() => remove(i)} disabled={fields.length === 1}><Trash2Icon /></Button>
                    </div>
                  </div>

                  <div className="grid gap-4 p-3">
                    {esReposicion ? (
                      <RestockPicker
                        index={i}
                        elegida={elegida}
                        onPick={(prod) => { setCatalog((c) => ({ ...c, [prod.id]: prod })); form.setValue(`lines.${i}.productId`, prod.id, { shouldValidate: true }); }}
                        error={form.formState.errors.lines?.[i]?.productId?.message}
                      />
                    ) : (
                      <>
                        <div className="grid gap-3 lg:grid-cols-[1fr_150px_170px_90px]">
                          <FormField control={form.control} name={`lines.${i}.title`} render={({ field }) => (
                            <FormItem><FormLabel>Título (inglés)</FormLabel><FormControl><Input placeholder="Miami Cuban Bracelet 5mm" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={form.control} name={`lines.${i}.type`} render={({ field }) => (
                            <FormItem><FormLabel>Tipo</FormLabel><FormControl><select className={selectCls} {...field}>{PRODUCT_TYPES.map((x) => <option key={x} value={x}>{TYPE_LABELS[x]}</option>)}</select></FormControl></FormItem>
                          )} />
                          <FormField control={form.control} name={`lines.${i}.subcategory`} render={({ field }) => (
                            <FormItem><FormLabel>Subcategoría</FormLabel><FormControl><select className={selectCls} {...field}>{subcats.map((s) => <option key={s} value={s}>{s}</option>)}</select></FormControl></FormItem>
                          )} />
                          <FormField control={form.control} name={`lines.${i}.karat`} render={({ field }) => (
                            <FormItem><FormLabel>Kilataje</FormLabel><FormControl><select className={selectCls} {...field}>{KARATS.map((k) => <option key={k} value={k}>{k}</option>)}</select></FormControl></FormItem>
                          )} />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <FormField control={form.control} name={`lines.${i}.grams`} render={({ field }) => (
                            <FormItem>
                              <FormLabel>Gramos</FormLabel>
                              <FormControl><Input type="number" step="0.01" min="0" placeholder="8.35" className="no-spinner font-mono" {...field} value={field.value ?? ""} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name={`lines.${i}.optionValue`} render={({ field }) => (
                            <FormItem>
                              <FormLabel>{type === "ring" ? "Talla" : "Largo"}</FormLabel>
                              <FormControl><Input placeholder={type === "ring" ? "7" : "18"} className="font-mono" {...field} /></FormControl>
                              <FormDescription>Va al SKU como sufijo. Vacío si no tiene.</FormDescription>
                            </FormItem>
                          )} />
                          <FormField control={form.control} name={`lines.${i}.status`} render={({ field }) => (
                            <FormItem>
                              <FormLabel>Estado</FormLabel>
                              <FormControl><select className={selectCls} {...field}><option value="draft">Borrador</option><option value="active">Activo</option></select></FormControl>
                              <FormDescription>Borrador hasta tener las fotos.</FormDescription>
                            </FormItem>
                          )} />
                          <FormItem>
                            <FormLabel>Precio al público</FormLabel>
                            <div className="flex h-9 items-center font-mono text-sm">{t?.grams ? formatCents(t.precio) : "—"}</div>
                            <FormDescription>{t?.grams ? `${t.grams.toFixed(2)} g × ${formatCents(pricePerGramCents)}/g` : "Se calcula con los gramos"}</FormDescription>
                          </FormItem>
                        </div>
                        <FormField control={form.control} name={`lines.${i}.extraTags`} render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tags extra</FormLabel>
                            <div className="flex flex-wrap gap-3">
                              {EXTRA_TAGS.map((tag) => (
                                <label key={tag} className="flex items-center gap-1.5 text-sm">
                                  <Checkbox checked={field.value?.includes(tag)} onCheckedChange={(c) => field.onChange(c ? [...(field.value ?? []), tag] : (field.value ?? []).filter((x) => x !== tag))} />
                                  {tag}
                                </label>
                              ))}
                            </div>
                          </FormItem>
                        )} />
                        <FormField control={form.control} name={`lines.${i}.descriptionHtml`} render={({ field }) => (
                          <FormItem>
                            <FormLabel>Descripción (inglés)</FormLabel>
                            <FormControl><Textarea rows={2} {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name={`lines.${i}.priceOverride`} render={({ field }) => (
                          <FormItem>
                            <label className="flex items-center gap-2 text-sm">
                              <Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(Boolean(c))} />
                              Ponerle un precio distinto al de la fórmula
                            </label>
                          </FormItem>
                        )} />
                        {l?.priceOverride && (
                          <FormField control={form.control} name={`lines.${i}.price`} render={({ field }) => (
                            <FormItem className="max-w-[220px]">
                              <FormLabel>Precio manual (USD)</FormLabel>
                              <FormControl><Input type="number" step="0.01" min="0" className="no-spinner font-mono" {...field} value={field.value ?? ""} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        )}
                      </>
                    )}

                    <div className="grid gap-3 border-t pt-3 sm:grid-cols-3 lg:grid-cols-4">
                      <FormField control={form.control} name={`lines.${i}.qty`} render={({ field }) => (
                        <FormItem><FormLabel>Cantidad</FormLabel><FormControl><Input type="number" step="1" min="1" className="no-spinner font-mono" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name={`lines.${i}.premium`} render={({ field }) => (
                        <FormItem>
                          <FormLabel>+ por gramo</FormLabel>
                          <FormControl><Input type="number" step="1" min="0" list="premium-presets" placeholder="0" aria-label={`Aumento por gramo de la pieza ${i + 1}`} className="no-spinner font-mono" {...field} value={field.value ?? ""} /></FormControl>
                          <FormDescription>{base > 0 ? `${formatCents(t?.perGram ?? base)}/g` : "Sobre la base"}</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name={`lines.${i}.unitCost`} render={({ field }) => (
                        <FormItem>
                          <FormLabel>Costo cerrado (opcional)</FormLabel>
                          <FormControl><Input type="number" step="0.01" min="0" placeholder={formatCents(t?.unit ?? 0)} className="no-spinner font-mono" {...field} value={field.value ?? ""} /></FormControl>
                          <FormDescription>Solo si el proveedor te cerró un precio.</FormDescription>
                        </FormItem>
                      )} />
                      {esReposicion && elegida && (
                        <FormField control={form.control} name={`lines.${i}.updateExisting`} render={({ field }) => (
                          <FormItem>
                            <FormLabel>Precio de la pieza vieja</FormLabel>
                            <label className="flex items-start gap-2 text-sm">
                              <Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(Boolean(c))} />
                              <span>
                                Actualizar al de esta compra
                                <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                                  costo {formatCents(elegida.costCents)} → {formatCents(t?.unit ?? 0)}
                                </span>
                                {elegida.priceOverride && <span className="mt-0.5 block text-[11px] text-muted-foreground">Tiene precio manual: el precio no se toca.</span>}
                              </span>
                            </label>
                          </FormItem>
                        )} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <datalist id="premium-presets">{PREMIUM_PRESETS.map((v) => <option key={v} value={v} />)}</datalist>
            <div>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ ...emptyLine(), premium: w.lines?.at(-1)?.premium ?? 0, type: w.lines?.at(-1)?.type ?? "necklace", subcategory: w.lines?.at(-1)?.subcategory ?? "chains" })}>
                <PlusIcon /> Agregar pieza
              </Button>
            </div>
            {form.formState.errors.lines?.root && <p className="text-sm text-destructive">{form.formState.errors.lines.root.message}</p>}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Totales</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="tax" render={({ field }) => (
                  <FormItem><FormLabel>Impuestos (USD)</FormLabel><FormControl><Input type="number" step="0.01" min="0" className="no-spinner font-mono" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="shipping" render={({ field }) => (
                  <FormItem><FormLabel>Envío (USD)</FormLabel><FormControl><Input type="number" step="0.01" min="0" className="no-spinner font-mono" {...field} /></FormControl></FormItem>
                )} />
              </div>
              <dl className="grid grid-cols-2 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Gramos totales</dt><dd className="text-right font-mono">{totalGramos.toFixed(2)} g</dd>
                <dt className="text-muted-foreground">Subtotal</dt><dd className="text-right font-mono">{formatCents(subtotal)}</dd>
                <dt className="font-medium">Total de la factura</dt><dd className="text-right font-mono text-lg">{formatCents(total)}</dd>
                {totalGramos > 0 && <><dt className="text-muted-foreground">Costo real por gramo</dt><dd className="text-right font-mono">{formatCents(Math.round(total / totalGramos))}/g</dd></>}
              </dl>
            </CardContent>
          </Card>

          <Card className={pagosCuadran ? "" : "border-destructive/60"}>
            <CardHeader>
              <CardTitle>Cuándo pagás</CardTitle>
              <CardDescription>Poné las fechas en las que tenés que pagar esta mercadería. Con una sola fecha, el monto sigue al total solo.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {pagos.fields.map((f, i) => (
                <div key={f.id} className="grid grid-cols-[1fr_1fr_32px] gap-2">
                  <FormField control={form.control} name={`payments.${i}.amount`} render={({ field }) => (
                    <FormItem><FormControl><Input type="number" step="0.01" min="0" placeholder="Monto" className="no-spinner font-mono" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={form.control} name={`payments.${i}.dueOn`} render={({ field }) => (
                    <FormItem><FormControl><Input type="date" aria-label={`Fecha de pago ${i + 1}`} className="font-mono" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <Button type="button" variant="ghost" size="icon" aria-label={`Quitar la fecha de pago ${i + 1}`} onClick={() => pagos.remove(i)} disabled={pagos.fields.length === 1}><Trash2Icon /></Button>
                </div>
              ))}
              <div>
                <Button type="button" variant="outline" size="sm" onClick={() => pagos.append({ amount: 0, dueOn: w.date ?? hoy() })}><PlusIcon /> Otra fecha</Button>
              </div>
              <p className={`text-xs ${pagosCuadran ? "text-muted-foreground" : "text-destructive"}`}>
                {pagosCuadran
                  ? `Las fechas suman ${formatCents(pagado)}, igual que la factura.`
                  : `Las fechas suman ${formatCents(pagado)} y la factura da ${formatCents(total)}. Tienen que coincidir.`}
              </p>
              {pagos.fields.length > 1 && (
                <ul className="text-sm">
                  {(w.payments ?? []).map((p, i) => (
                    <li key={i} className="flex justify-between border-b py-1 last:border-0">
                      <span className="font-mono text-xs text-muted-foreground">{p?.dueOn ? dateFmt.format(new Date(`${p.dueOn}T00:00:00Z`)) : "—"}</span>
                      <span className="font-mono">{formatCents(Math.round((Number(p?.amount) || 0) * 100))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem><FormLabel>Notas</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl></FormItem>
        )} />

        <div className="flex items-center justify-end gap-3">
          {!pagosCuadran && <span className="text-sm text-destructive">Revisá las fechas de pago.</span>}
          <Button type="submit" variant="gold" size="lg" disabled={pending || !pagosCuadran}>
            {pending ? "Guardando…" : "Guardar entrada"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

/** Busca una pieza del inventario para sumarle unidades. */
function RestockPicker({ index, elegida, onPick, error }: { index: number; elegida?: Found; onPick: (p: Found) => void; error?: string }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Found[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await searchProductsAction(q);
        setRows(r.ok ? r.data ?? [] : []);
        setError(r.ok ? null : r.error);
      } catch {
        setRows([]);
        setError("No se pudo buscar. Probá de nuevo.");
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="grid gap-2">
      <FormLabel>Pieza que estás reponiendo</FormLabel>
      <div ref={box} className="relative">
        <div className="flex items-center gap-2">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Buscá por SKU o por título"
            aria-label={`Buscar la pieza a reponer de la línea ${index + 1}`}
          />
        </div>
        {open && (
          <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-card shadow-md">
            {loading && <p className="px-3 py-2 text-sm text-muted-foreground">Buscando…</p>}
            {!loading && failed && <p className="px-3 py-2 text-sm text-destructive">{failed}</p>}
            {!loading && !failed && rows.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">No hay piezas que coincidan.</p>}
            {rows.map((r) => (
              <button key={r.id} type="button" onClick={() => { onPick(r); setOpen(false); setQ(""); }}
                className="flex w-full items-center justify-between gap-3 border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-arena/40">
                <span className="min-w-0">
                  <span className="block truncate">{r.title}{r.optionValue ? ` · ${r.optionValue}` : ""}</span>
                  <span className="font-mono text-xs text-muted-foreground">{r.sku} · {r.grams.toFixed(2)} g</span>
                </span>
                <span className="shrink-0 text-right font-mono text-xs">
                  <span className="block">{formatCents(r.priceCents)}</span>
                  <span className="block text-muted-foreground">costo {formatCents(r.costCents)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {elegida ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-arena/20 px-3 py-2 text-sm">
          <Badge variant="gold">{elegida.sku}</Badge>
          <span className="font-medium">{elegida.title}</span>
          <span className="font-mono text-xs text-muted-foreground">
            {elegida.grams.toFixed(2)} g · costo {formatCents(elegida.costCents)} · precio {formatCents(elegida.priceCents)}
          </span>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Los gramos y el SKU salen de la pieza que elijas. Si el peso es distinto, no es la misma pieza: cargala como primera vez.</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
