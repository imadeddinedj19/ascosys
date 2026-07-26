"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TransactionCategory } from "@/lib/supabase/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type CategoryInput = {
  name: string;
  direction: TransactionCategory["direction"];
  color: string;
  active: boolean;
};

export async function saveCategory(id: string | null, input: CategoryInput): Promise<ActionResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Le nom de la catégorie est obligatoire." };

  const supabase = await createClient();
  if (id) {
    const { error } = await supabase
      .from("transaction_categories")
      .update({ name, direction: input.direction, color: input.color, active: input.active })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    // Place la nouvelle catégorie en fin de liste.
    const { data: last } = await supabase
      .from("transaction_categories")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const sort_order = (last?.sort_order ?? 0) + 10;
    const { error } = await supabase
      .from("transaction_categories")
      .insert({ name, direction: input.direction, color: input.color, active: input.active, sort_order });
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/parametres");
  revalidatePath("/tresorerie");
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("transaction_categories").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/parametres");
  revalidatePath("/tresorerie");
  return { ok: true };
}

const intOrNull = (v: string): number | null => {
  const t = (v ?? "").trim();
  if (t === "") return null;
  const x = parseInt(t, 10);
  return Number.isFinite(x) && x >= 0 ? x : null;
};

/** Fixe le dernier numéro de facture utilisé cette année (prochaine facture = last + 1). */
export async function setFactureCounter(lastUsed: string): Promise<ActionResult> {
  const last = intOrNull(lastUsed);
  if (last === null) return { ok: false, error: "Numéro invalide (entier positif attendu)." };
  const year = new Date().getFullYear();
  const supabase = await createClient();
  const { error } = await supabase.from("facture_counters").upsert({ year, last }, { onConflict: "year" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/parametres");
  return { ok: true };
}

/** Fixe le dernier numéro de bon de livraison utilisé ce mois-ci (prochain = last + 1). */
export async function setBlCounter(lastUsed: string): Promise<ActionResult> {
  const last = intOrNull(lastUsed);
  if (last === null) return { ok: false, error: "Numéro invalide (entier positif attendu)." };
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const supabase = await createClient();
  const { error } = await supabase.from("bl_counters").upsert({ year, month, last }, { onConflict: "year,month" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/parametres");
  return { ok: true };
}
