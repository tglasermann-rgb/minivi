"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Inventario es un solo lugar: las piezas que vendés y las entradas con las que
 * llegaron. Antes eran dos tabs distintos y había que cargar el producto dos veces.
 */
const TABS = [
  { href: "/app/inventario", label: "Piezas", exact: true },
  { href: "/app/inventario/entradas", label: "Entradas" },
  { href: "/app/inventario/cuentas", label: "Cuentas por pagar" },
  { href: "/app/inventario/proveedores", label: "Proveedores" },
];

export function InventarioNav() {
  const path = usePathname();
  return (
    <nav className="mb-4 flex flex-wrap gap-1 border-b" aria-label="Secciones de inventario">
      {TABS.map((t) => {
        const active = t.exact ? path === t.href : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${active ? "border-oro font-medium text-oro-profundo" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
