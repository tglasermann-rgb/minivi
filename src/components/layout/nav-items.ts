import {
  HomeIcon, ShoppingCartIcon, GemIcon, ReceiptIcon, WalletIcon, UsersIcon, BarChart3Icon, SettingsIcon,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { href: "/app", label: "Inicio", icon: HomeIcon },
  { href: "/app/compras", label: "Compras", icon: ShoppingCartIcon },
  { href: "/app/inventario", label: "Inventario", icon: GemIcon },
  { href: "/app/ventas", label: "Ventas", icon: ReceiptIcon },
  { href: "/app/gastos", label: "Gastos", icon: WalletIcon },
  { href: "/app/empleados", label: "Empleados", icon: UsersIcon },
  { href: "/app/reportes", label: "Reportes", icon: BarChart3Icon },
  { href: "/app/configuracion", label: "Configuración", icon: SettingsIcon },
];
