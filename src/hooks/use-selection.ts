"use client";

import { useCallback, useMemo, useState } from "react";

/** Gère la sélection multiple de lignes par identifiant. */
export function useSelection(allIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => (prev.size === allIds.length ? new Set() : new Set(allIds)));
  }, [allIds]);

  // Retire les ids disparus (après suppression) sans effet de bord dans le rendu.
  const validSelected = useMemo(() => {
    const set = new Set(allIds);
    return [...selected].filter((id) => set.has(id));
  }, [selected, allIds]);

  const allChecked = allIds.length > 0 && validSelected.length === allIds.length;
  const someChecked = validSelected.length > 0 && !allChecked;

  return {
    selected: validSelected,
    count: validSelected.length,
    isSelected: (id: string) => selected.has(id),
    toggle,
    toggleAll,
    clear,
    allChecked,
    someChecked,
  };
}
