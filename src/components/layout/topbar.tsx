"use client";

import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/components/layout/nav";
import { LogoutButton } from "@/components/auth/logout-button";
import { MobileNav } from "@/components/layout/mobile-nav";
import { isSupabaseConfigured } from "@/lib/supabase/config";

function useTitle() {
  const pathname = usePathname();
  const match =
    NAV_ITEMS.filter((i) => (i.href === "/" ? pathname === "/" : pathname.startsWith(i.href)))
      .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.label ?? "AscoSys";
}

export function Topbar() {
  const title = useTitle();
  const demo = !isSupabaseConfigured();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/80 px-3 sm:px-5 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-3">
        <MobileNav />
        <h1 className="truncate text-base font-semibold text-foreground">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        {demo && (
          <span className="hidden sm:inline-flex items-center gap-2 rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-xs text-warning">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" />
            Mode démo — Supabase non connecté
          </span>
        )}
        <LogoutButton />
      </div>
    </header>
  );
}
