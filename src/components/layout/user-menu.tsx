"use client";
import { LogOutIcon, UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export function UserMenu({ email, fullName, role }: { email: string; fullName: string | null; role: "owner" | "kiosk" }) {
  const initials = (fullName ?? email).slice(0, 2).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="w-full justify-start gap-3 px-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground">
          <span className="flex size-7 items-center justify-center rounded-full bg-oro font-display text-xs text-tinta">{initials}</span>
          <span className="flex min-w-0 flex-col items-start">
            <span className="w-full truncate text-sm">{fullName ?? email}</span>
            <span className="text-[11px] text-sidebar-muted">{role === "owner" ? "Dueño" : "Kiosco"}</span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span className="truncate font-normal">{email}</span>
          <Badge variant={role === "owner" ? "gold" : "secondary"}>{role}</Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <UserIcon /> Mi perfil (próximamente)
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/auth/signout">
            <LogOutIcon /> Cerrar sesión
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
