"use client";
import { useState } from "react";
import Link from "next/link";
import { MenuIcon } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";
import type { CurrentUser } from "@/lib/auth";

function SidebarInner({ user, onNavigate }: { user: CurrentUser; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Link href="/app" onClick={onNavigate} aria-label="Inicio">
          <Logo tone="oro" height={20} />
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        <SidebarNav onNavigate={onNavigate} />
      </div>
      <div className="border-t border-sidebar-border p-2">
        <UserMenu email={user.email} fullName={user.fullName} role={user.role} />
      </div>
    </div>
  );
}

/** Layout general: sidebar fija en desktop, sheet lateral en móvil. */
export function AppShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-60 shrink-0 bg-sidebar text-sidebar-foreground md:fixed md:inset-y-0 md:flex md:flex-col">
        <SidebarInner user={user} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col md:pl-60">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-sidebar px-4 text-sidebar-foreground md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground" aria-label="Abrir menú">
                <MenuIcon />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" dark className="w-64 p-0">
              <SheetTitle className="sr-only">Menú</SheetTitle>
              <SidebarInner user={user} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <Link href="/app" aria-label="Inicio">
            <Logo tone="oro" height={18} />
          </Link>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
