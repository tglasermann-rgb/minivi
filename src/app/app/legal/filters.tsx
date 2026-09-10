"use client";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { SearchIcon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/lib/legal/expiry";
import type { LegalFilters } from "@/lib/legal/service";

const selectCls = "h-9 rounded-md border border-input bg-card px-2 text-sm";

export function LegalFiltersBar({ filters }: { filters: LegalFilters }) {
  const router = useRouter();
  const pathname = usePathname();
  const [f, setF] = useState(filters);
  function apply(next: LegalFilters) {
    setF(next);
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
    router.push(`${pathname}?${params.toString()}`);
  }
  const active = Object.values(f).some(Boolean);
  return (
    <form onSubmit={(e) => { e.preventDefault(); apply(f); }} className="mb-3 flex flex-wrap items-center gap-2">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
        <Input value={f.q ?? ""} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Título, contraparte, número" className="w-60 pl-8" />
      </div>
      <select className={selectCls} value={f.category ?? ""} onChange={(e) => apply({ ...f, category: e.target.value as LegalFilters["category"] })} aria-label="Categoría">
        <option value="">Todas las categorías</option>
        {Object.entries(CATEGORY_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
      </select>
      <select className={selectCls} value={f.status ?? ""} onChange={(e) => apply({ ...f, status: e.target.value as LegalFilters["status"] })} aria-label="Estado">
        <option value="">Todos los estados</option>
        {Object.entries(STATUS_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
      </select>
      <select className={selectCls} value={f.expiry ?? ""} onChange={(e) => apply({ ...f, expiry: e.target.value as LegalFilters["expiry"] })} aria-label="Vencimiento">
        <option value="">Cualquier vencimiento</option>
        <option value="por_vencer">Por vencer</option>
        <option value="vencido">Vencidos</option>
        <option value="vigente">Vigentes</option>
        <option value="sin_vencimiento">Sin vencimiento</option>
      </select>
      <Button type="submit" variant="outline" size="sm">Buscar</Button>
      {active && <Button type="button" variant="ghost" size="sm" onClick={() => apply({})}><XIcon /> Limpiar</Button>}
    </form>
  );
}
