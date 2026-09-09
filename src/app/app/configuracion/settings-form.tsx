"use client";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { settingsFormSchema, type SettingsFormValues } from "./schema";
import { updateSettings } from "./actions";

export function SettingsForm({ defaultValues }: { defaultValues: SettingsFormValues }) {
  const [pending, startTransition] = useTransition();
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues,
  });

  function onSubmit(values: SettingsFormValues) {
    startTransition(async () => {
      const res = await updateSettings(values);
      if (res.ok) {
        toast.success("Configuración guardada");
        form.reset(values);
      } else {
        toast.error(res.error);
        for (const [name, msgs] of Object.entries(res.fieldErrors ?? {})) {
          form.setError(name as keyof SettingsFormValues, { message: msgs?.[0] });
        }
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Precio y costo</CardTitle>
            <CardDescription>Se aplican a todo producto nuevo. Un producto con precio sobrescrito no cambia.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <FormField control={form.control} name="precio_por_gramo" render={({ field }) => (
              <FormItem>
                <FormLabel>Precio por gramo (USD)</FormLabel>
                <FormControl><Input type="number" step="0.01" min="0" inputMode="decimal" className="font-mono" {...field} /></FormControl>
                <FormDescription>Precio al público = gramos × este valor.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="redondeo_precio" render={({ field }) => (
              <FormItem>
                <FormLabel>Redondeo del precio (USD)</FormLabel>
                <FormControl><Input type="number" step="0.01" min="0" inputMode="decimal" className="font-mono" {...field} /></FormControl>
                <FormDescription>Se redondea hacia arriba a este múltiplo.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="costo_por_gramo_default" render={({ field }) => (
              <FormItem>
                <FormLabel>Costo por gramo por defecto (USD)</FormLabel>
                <FormControl><Input type="number" step="0.01" min="0" inputMode="decimal" className="font-mono" {...field} /></FormControl>
                <FormDescription>Sugerido al crear una compra; cada compra tiene el suyo.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Producto</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <FormField control={form.control} name="kilataje_default" render={({ field }) => (
              <FormItem>
                <FormLabel>Kilataje por defecto</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="10k">10k</SelectItem>
                    <SelectItem value="14k">14k</SelectItem>
                    <SelectItem value="18k">18k</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nómina y tienda</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <FormField control={form.control} name="semana_inicia" render={({ field }) => (
              <FormItem>
                <FormLabel>La semana empieza el</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="monday">Lunes</SelectItem>
                    <SelectItem value="sunday">Domingo</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>Para contar las 40 h de la hora extra.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="overtime_umbral_horas" render={({ field }) => (
              <FormItem>
                <FormLabel>Umbral de hora extra (h/semana)</FormLabel>
                <FormControl><Input type="number" step="1" min="1" inputMode="numeric" className="font-mono" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="tienda_timezone" render={({ field }) => (
              <FormItem>
                <FormLabel>Zona horaria de la tienda</FormLabel>
                <FormControl><Input className="font-mono" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          {form.formState.isDirty && <span className="text-sm text-muted-foreground">Hay cambios sin guardar</span>}
          <Button type="submit" variant="gold" disabled={pending || !form.formState.isDirty}>
            {pending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
