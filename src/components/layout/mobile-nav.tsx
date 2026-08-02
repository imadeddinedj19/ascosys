"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { NAV_ITEMS } from "@/components/layout/nav";
import { Brand } from "@/components/layout/brand";
import { cn } from "@/lib/utils";

/**
 * Navigation mobile : bouton hamburger + tiroir latéral portalisé sur document.body
 * (échappe aux stacking contexts créés par le topbar et les Card en backdrop-blur).
 * Reprend intégralement la liste des rubriques du sidebar desktop.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);

  // Ferme automatiquement à chaque changement de route.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Bloque le scroll du body quand le tiroir est ouvert.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape pour fermer.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const groups = NAV_ITEMS.reduce<Record<string, typeof NAV_ITEMS>>((acc, item) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir le menu"
        className="md:hidden inline-flex size-9 items-center justify-center rounded-md border border-border bg-surface-2 text-muted hover:text-foreground hover:border-primary/40 cursor-pointer"
      >
        <Menu className="size-4" />
      </button>

      {open && mounted && createPortal(
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Menu principal"
            className="fixed left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col border-r border-border bg-surface shadow-2xl"
          >
            <div className="flex h-16 items-center justify-between border-b border-border px-5">
              <Brand />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer le menu"
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>
            <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
              {Object.entries(groups).map(([group, items]) => (
                <div key={group}>
                  <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                    {group}
                  </p>
                  <ul className="space-y-0.5">
                    {items.map((item) => {
                      const active =
                        item.href === "/"
                          ? pathname === "/"
                          : pathname.startsWith(item.href);
                      const Icon = item.icon;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                              active
                                ? "border border-primary/20 bg-primary/10 text-primary"
                                : "border border-transparent text-muted hover:bg-surface-2 hover:text-foreground",
                            )}
                          >
                            <Icon className="size-4 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
            <div className="border-t border-border px-5 py-3">
              <p className="text-[11px] text-muted-foreground">AscoSys 1.0 · ATG</p>
            </div>
          </aside>
        </div>,
        document.body,
      )}
    </>
  );
}
