"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/components/layout/nav";
import { Brand } from "@/components/layout/brand";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();

  // Regroupe les entrées par section
  const groups = NAV_ITEMS.reduce<Record<string, typeof NAV_ITEMS>>((acc, item) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-surface/60 backdrop-blur-sm">
      <div className="flex h-16 items-center px-5 border-b border-border">
        <Brand />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
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
                      className={cn(
                        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "text-muted hover:bg-surface-2 hover:text-foreground border border-transparent",
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
  );
}
