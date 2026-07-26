"use client";

import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Barre flottante d'actions groupées qui apparaît quand des lignes sont sélectionnées. */
export function SelectionBar({
  count,
  onClear,
  onDelete,
  pending,
  noun = "élément",
}: {
  count: number;
  onClear: () => void;
  onDelete: () => void;
  pending?: boolean;
  noun?: string;
}) {
  if (count === 0) return null;
  const label = `${count} ${noun}${count > 1 ? "s" : ""} sélectionné${count > 1 ? "s" : ""}`;
  return (
    <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-border bg-surface-2/95 py-2 pl-4 pr-2 shadow-lg backdrop-blur">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <Button variant="danger" size="sm" onClick={onDelete} disabled={pending}>
          <Trash2 className="size-4" /> {pending ? "Suppression…" : "Supprimer"}
        </Button>
        <button
          type="button"
          onClick={onClear}
          aria-label="Annuler la sélection"
          className="grid size-7 place-items-center rounded-full text-muted hover:bg-surface hover:text-foreground cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
