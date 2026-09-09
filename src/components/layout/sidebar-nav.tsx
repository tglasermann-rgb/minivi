"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5 px-2" aria-label="Principal">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
              active
                ? "bg-sidebar-accent text-oro-claro"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
            )}
          >
            <Icon className={cn("size-4 shrink-0", active ? "text-oro" : "text-sidebar-muted")} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
