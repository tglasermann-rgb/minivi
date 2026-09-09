"use client";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { SearchIcon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PRODUCT_TYPES, STATUS_LABELS, SUBCATEGORIES, TYPE_LABELS } from "@/lib/inventory/constants";
import type { InventoryFilters } from "./queries";

const selectCls = "h-9 rounded-md border border-input bg-card px-2 text-sm";

export function InventoryFiltersBar({ filters }: { filters: InventoryFilters }) {
  const router = useRouter();
  const pathname = usePathname();
  const [f, setF] = useState(filters);

  function apply(next: InventoryFilters) {
    setF(next);
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
    router.push(`${pathname}?${params.toString()}`);
  }
  const set = (k: keyof InventoryFilters) => (e: React.ChangeEvent<HTMLSelectElement>) => apply({ ...f, [k]: e.target.value });
  const active = Object.values(f).some(Boolean);

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); apply(f); }}
      className="mb-3 flex flex-wrap items-center gap-2"
    >
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
        <Input value={f.q ?? ""} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="SKU o título" className="w-52 pl-8" />
      </div>
      <select className={selectCls} value={f.type ?? ""} onChange={set("type")} aria-label="Tipo">
        <option value="">Todos los tipos</option>
        {PRODUCT_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
      </select>
      <select className={selectCls} value={f.subcategory ?? ""} onChange={set("subcategory")} aria-label="Subcategoría">
        <option value="">Todas las subcategorías</option>
        {SUBCATEGORIES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <select className={selectCls} value={f.status ?? ""} onChange={set("status")} aria-label="Estado">
        <option value="">Activos y borradores</option>
        {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <select className={selectCls} value={f.photo ?? ""} onChange={set("photo")} aria-label="Foto">
        <option value="">Con o sin foto</option>
        <option value="with">Con foto</option>
        <option value="without">Sin foto</option>
      </select>
      <select className={selectCls} value={f.shopify ?? ""} onChange={set("shopify")} aria-label="Shopify">
        <option value="">Con o sin Shopify</option>
        <option value="with">Publicados</option>
        <option value="without">Sin publicar</option>
      </select>
      <select className={selectCls} value={f.stock ?? ""} onChange={set("stock")} aria-label="Stock">
        <option value="">Con o sin stock</option>
        <option value="in">Con stock</option>
        <option value="out">Sin stock</option>
      </select>
      <Button type="submit" variant="outline" size="sm">Buscar</Button>
      {active && (
        <Button type="button" variant="ghost" size="sm" onClick={() => apply({})}><XIcon /> Limpiar</Button>
      )}
    </form>
  );
}
