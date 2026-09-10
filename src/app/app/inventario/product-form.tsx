"use client";
import { useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { EXTRA_TAGS, KARATS, PRODUCT_TYPES, STATUS_LABELS, SUBCATEGORIES, SUBCATEGORIES_BY_TYPE, TYPE_LABELS } from "@/lib/inventory/constants";
import { computeCostCents, computePriceCents } from "@/lib/inventory/pricing";
import { hasForbiddenPublicText } from "@/lib/inventory/tags";
import { formatCents } from "@/lib/money";
import { productFormSchema, type ProductFormInput, type ProductFormValues } from "./schema";
import { createProductAction, updateProductAction } from "./actions";
import type { ProductType } from "@/generated/prisma/client";

export type PricingParams = { pricePerGramCents: number; roundingCents: number; costPerGramDefaultCents: number; karatDefault: string };
export type BaseOption = { id: string; sku: string; title: string; type: ProductType; optionName: string | null; optionValue: string | null };

type Props = {
  mode: "create" | "edit";
  productId?: string;
  pricing: PricingParams;
  bases?: BaseOption[];
  defaultValues?: Partial<ProductFormInput>;
  lockedSku?: string;
};

export function ProductForm({ mode, productId, pricing, bases = [], defaultValues, lockedSku }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<ProductFormInput, unknown, ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      title: "",
      type: "necklace",
      subcategory: "chains",
      extraTags: [],
      karat: (pricing.karatDefault as ProductFormInput["karat"]) ?? "14k",
      grams: undefined,
      descriptionHtml: "",
      optionValue: "",
      optionName: "",
      variantOfId: "",
      costMode: "perGram",
      costPerGram: pricing.costPerGramDefaultCents / 100,
      costTotal: undefined,
      priceOverride: false,
      price: undefined,
      status: "draft",
      notes: "",
      initialQty: 0,
      ...defaultValues,
    },
  });

  const w = form.watch();
  const type = w.type as ProductType;
  const grams = Number(w.grams) || 0;
  const autoPrice = useMemo(() => (grams > 0 ? computePriceCents(grams, pricing.pricePerGramCents, pricing.roundingCents) : 0), [grams, pricing]);
  const autoCost = useMemo(() => {
    if (w.costMode === "total") return Math.round((Number(w.costTotal) || 0) * 100);
    return grams > 0 ? computeCostCents(grams, Math.round((Number(w.costPerGram) || 0) * 100)) : 0;
  }, [grams, w.costMode, w.costTotal, w.costPerGram]);
  const variantOf = bases.find((b) => b.id === w.variantOfId);
  const forbidden = hasForbiddenPublicText(w.title ?? "") || hasForbiddenPublicText(w.descriptionHtml ?? "");

  // Al elegir un producto base, heredar título/tipo/opción.
  useEffect(() => {
    if (!variantOf) return;
    form.setValue("title", bases.find((b) => b.id === variantOf.id)?.title ?? w.title);
    form.setValue("type", variantOf.type);
    if (variantOf.optionName) form.setValue("optionName", variantOf.optionName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.variantOfId]);

  function onSubmit(values: ProductFormValues) {
    startTransition(async () => {
      const res = mode === "create" ? await createProductAction(values) : await updateProductAction(productId!, values);
      if (res.ok) {
        toast.success(res.message ?? "Guardado");
        if (mode === "create" && res.data) router.push(`/app/inventario/${res.data.id}`);
        else router.refresh();
      } else {
        toast.error(res.error);
        for (const [name, msgs] of Object.entries(res.fieldErrors ?? {})) form.setError(name as keyof ProductFormInput, { message: msgs?.[0] });
      }
    });
  }

  const subcats = [...SUBCATEGORIES_BY_TYPE[type], ...SUBCATEGORIES.filter((s) => !SUBCATEGORIES_BY_TYPE[type].includes(s))];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-3">
        <div className="grid gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Producto</CardTitle>
              <CardDescription>Título y descripción en inglés. Nunca &quot;solid gold&quot;: usar &quot;real 14k gold&quot;, &quot;stamped 14k&quot;, &quot;no plating&quot;.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {mode === "create" && bases.length > 0 && (
                <FormField control={form.control} name="variantOfId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>¿Es variante de un producto existente?</FormLabel>
                    <Select onValueChange={(v) => field.onChange(v === "none" ? "" : v)} value={field.value || "none"}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none">No, es un producto nuevo</SelectItem>
                        {bases.map((b) => <SelectItem key={b.id} value={b.id}>{b.sku} · {b.title}{b.optionValue ? ` (${b.optionValue})` : ""}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormDescription>Las variantes (otro largo o talla) comparten número de SKU y se publican como un solo producto en Shopify.</FormDescription>
                  </FormItem>
                )} />
              )}
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Título (inglés)</FormLabel>
                  <FormControl><Input placeholder="Cuban Link Chain 3mm" {...field} disabled={!!variantOf} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={mode === "edit" || !!variantOf}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{PRODUCT_TYPES.map((t) => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
                    </Select>
                    {mode === "edit" && <FormDescription>No se cambia: el SKU es inmutable.</FormDescription>}
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="subcategory" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subcategoría</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{subcats.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="karat" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kilataje</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{KARATS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="extraTags" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags extra</FormLabel>
                  <div className="flex flex-wrap gap-3">
                    {EXTRA_TAGS.map((t) => (
                      <label key={t} className="flex items-center gap-1.5 text-sm">
                        <Checkbox checked={field.value?.includes(t)} onCheckedChange={(c) => field.onChange(c ? [...(field.value ?? []), t] : (field.value ?? []).filter((x) => x !== t))} />
                        {t}
                      </label>
                    ))}
                  </div>
                  <FormDescription>Los tags finales de Shopify se arman solos: tipo + subcategoría + extras + kilataje + real-gold.</FormDescription>
                </FormItem>
              )} />
              <FormField control={form.control} name="descriptionHtml" render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción (inglés, HTML simple)</FormLabel>
                  <FormControl><Textarea rows={5} placeholder="<p>Real 14k gold, stamped 14k. No plating.</p>" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              {forbidden && <p className="text-sm text-destructive">El título o la descripción dicen &quot;solid gold&quot;. Cambialo antes de guardar.</p>}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="optionName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de la opción</FormLabel>
                    <FormControl><Input placeholder={type === "ring" ? "Size" : "Length"} {...field} /></FormControl>
                    <FormDescription>Length para largos, Size para tallas. Vacío si no tiene variantes.</FormDescription>
                  </FormItem>
                )} />
                <FormField control={form.control} name="optionValue" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor de la opción</FormLabel>
                    <FormControl><Input placeholder={type === "ring" ? "7" : "18"} {...field} disabled={mode === "edit"} /></FormControl>
                    <FormDescription>Va al SKU como sufijo: -18, -7.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas internas</FormLabel>
                  <FormControl><Textarea rows={2} {...field} /></FormControl>
                </FormItem>
              )} />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 self-start">
          <Card>
            <CardHeader>
              <CardTitle>Peso, costo y precio</CardTitle>
              {lockedSku && <CardDescription className="font-mono">{lockedSku}</CardDescription>}
            </CardHeader>
            <CardContent className="grid gap-4">
              <FormField control={form.control} name="grams" render={({ field }) => (
                <FormItem>
                  <FormLabel>Gramos</FormLabel>
                  <FormControl><Input type="number" step="0.01" min="0" inputMode="decimal" className="font-mono" {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="costMode" render={({ field }) => (
                <FormItem>
                  <FormLabel>Costo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="perGram">Por gramo</SelectItem>
                      <SelectItem value="total">Total de la pieza</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              {w.costMode === "perGram" ? (
                <FormField control={form.control} name="costPerGram" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Costo por gramo (USD)</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" className="font-mono" {...field} value={field.value ?? ""} /></FormControl>
                    <FormDescription>Costo de la pieza: <span className="font-mono">{formatCents(autoCost)}</span></FormDescription>
                  </FormItem>
                )} />
              ) : (
                <FormField control={form.control} name="costTotal" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Costo total (USD)</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" className="font-mono" {...field} value={field.value ?? ""} /></FormControl>
                  </FormItem>
                )} />
              )}
              <div className="rounded-md bg-muted px-3 py-2 text-sm">
                Precio automático: <span className="font-mono text-base">{formatCents(autoPrice)}</span>
                <p className="text-xs text-muted-foreground">{grams || 0} g × {formatCents(pricing.pricePerGramCents)}/g, redondeado a {formatCents(pricing.roundingCents)}</p>
              </div>
              <FormField control={form.control} name="priceOverride" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-md border px-3 py-2">
                  <FormLabel className="cursor-pointer">Precio manual</FormLabel>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
              {w.priceOverride && (
                <FormField control={form.control} name="price" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Precio al público (USD)</FormLabel>
                    <FormControl><Input type="number" step="0.01" min="0" className="font-mono" {...field} value={field.value ?? ""} /></FormControl>
                    <FormDescription>No se recalcula al cambiar el precio por gramo.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </FormItem>
              )} />
              {mode === "create" && (
                <FormField control={form.control} name="initialQty" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock inicial (unidades)</FormLabel>
                    <FormControl><Input type="number" step="1" min="0" className="font-mono" {...field} /></FormControl>
                    <FormDescription>Crea un movimiento de ajuste. Lo normal es que el stock entre por Compras.</FormDescription>
                  </FormItem>
                )} />
              )}
            </CardContent>
          </Card>
          <Button type="submit" variant="gold" size="lg" disabled={pending || forbidden}>
            {pending ? "Guardando…" : mode === "create" ? "Crear producto" : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
