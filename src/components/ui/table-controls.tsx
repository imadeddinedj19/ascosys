"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownAZ, ArrowUpAZ, ArrowDown01, ArrowUp01, ListFilter, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortState = { key: string; dir: "asc" | "desc" } | null;
export type Filters = Record<string, Set<string>>;

/** État partagé de tri + filtres pour un tableau (façon Excel). */
export function useTableControls() {
  const [sort, setSort] = useState<SortState>(null);
  const [filters, setFilters] = useState<Filters>({});

  function toggleSort(key: string, dir: "asc" | "desc") {
    setSort((s) => (s && s.key === key && s.dir === dir ? null : { key, dir }));
  }
  function setColFilter(key: string, set: Set<string>) {
    setFilters((f) => {
      const next = { ...f };
      if (set.size === 0) delete next[key];
      else next[key] = set;
      return next;
    });
  }
  return { sort, toggleSort, filters, setColFilter };
}

/** Applique tri + filtres à une liste de lignes via des accesseurs par colonne. */
export function applyTableControls<T>(
  rows: T[],
  accessors: Record<string, (r: T) => string | number>,
  sort: SortState,
  filters: Filters,
): T[] {
  let out = rows;
  for (const [key, set] of Object.entries(filters)) {
    if (set && set.size > 0 && accessors[key]) {
      out = out.filter((r) => set.has(String(accessors[key](r))));
    }
  }
  if (sort && accessors[sort.key]) {
    const acc = accessors[sort.key];
    out = [...out].sort((a, b) => {
      const av = acc(a), bv = acc(b);
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), "fr", { numeric: true, sensitivity: "base" });
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }
  return out;
}

/**
 * En-tête de colonne cliquable : ouvre un menu de tri (A→Z / Z→A ou 1→9 / 9→1)
 * et un filtre par cases à cocher sur les valeurs distinctes de la colonne.
 */
export function HeaderMenu({
  label,
  colKey,
  values,
  numeric = false,
  controls,
  align = "left",
}: {
  label: string;
  colKey: string;
  values?: string[]; // valeurs distinctes pour le filtre ; omis = pas de filtre
  numeric?: boolean;
  controls: ReturnType<typeof useTableControls>;
  align?: "left" | "right" | "center";
}) {
  const { sort, toggleSort, filters, setColFilter } = controls;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const active = (filters[colKey]?.size ?? 0) > 0 || sort?.key === colKey;
  const selected = filters[colKey] ?? new Set<string>();

  const distinct = useMemo(() => {
    const list = [...new Set(values ?? [])];
    list.sort((a, b) => a.localeCompare(b, "fr", { numeric: true, sensitivity: "base" }));
    const query = q.trim().toLowerCase();
    return query ? list.filter((v) => v.toLowerCase().includes(query)) : list;
  }, [values, q]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function openMenu() {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ x: r.left, y: r.bottom + 4 });
    setQ("");
    setOpen((o) => !o);
  }

  function toggleValue(v: string) {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v); else next.add(v);
    setColFilter(colKey, next);
  }

  return (
    <div className={cn("flex items-center gap-1", align === "right" && "justify-end", align === "center" && "justify-center")}>
      <span>{label}</span>
      <button
        ref={btnRef}
        type="button"
        onClick={openMenu}
        aria-label={`Trier / filtrer ${label}`}
        className={cn("rounded p-0.5 cursor-pointer transition-colors", active ? "text-primary" : "text-muted-foreground hover:text-foreground")}
      >
        <ListFilter className="size-3.5" />
      </button>

      {open && pos && (
        <div
          ref={menuRef}
          style={{ position: "fixed", left: pos.x, top: pos.y }}
          className="z-50 w-56 overflow-hidden rounded-md border border-border bg-surface-2 text-left shadow-lg"
        >
          <div className="flex flex-col p-1">
            <button type="button" onClick={() => { toggleSort(colKey, "asc"); setOpen(false); }} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-muted hover:bg-surface hover:text-foreground">
              {numeric ? <ArrowDown01 className="size-4" /> : <ArrowDownAZ className="size-4" />}
              {numeric ? "Croissant (1 → 9)" : "Trier A → Z"}
              {sort?.key === colKey && sort.dir === "asc" && <Check className="ml-auto size-3.5 text-primary" />}
            </button>
            <button type="button" onClick={() => { toggleSort(colKey, "desc"); setOpen(false); }} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-muted hover:bg-surface hover:text-foreground">
              {numeric ? <ArrowUp01 className="size-4" /> : <ArrowUpAZ className="size-4" />}
              {numeric ? "Décroissant (9 → 1)" : "Trier Z → A"}
              {sort?.key === colKey && sort.dir === "desc" && <Check className="ml-auto size-3.5 text-primary" />}
            </button>
          </div>

          {values && values.length > 0 && (
            <div className="border-t border-border p-1">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filtrer</span>
                {selected.size > 0 && (
                  <button type="button" onClick={() => setColFilter(colKey, new Set())} className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <X className="size-3" /> Effacer
                  </button>
                )}
              </div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher une valeur…"
                className="mb-1 h-7 w-full rounded border border-border bg-input px-2 text-xs text-foreground outline-none placeholder:text-muted-foreground"
              />
              <ul className="max-h-48 overflow-y-auto">
                {distinct.map((v) => (
                  <li key={v}>
                    <button type="button" onClick={() => toggleValue(v)} className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm text-muted hover:bg-surface">
                      <span className={cn("grid size-3.5 place-items-center rounded border", selected.has(v) ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                        {selected.has(v) && <Check className="size-2.5" />}
                      </span>
                      <span className="truncate">{v || "—"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
