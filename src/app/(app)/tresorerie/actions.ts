"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TransactionDirection } from "@/lib/supabase/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type TransactionInput = {
  date: string;
  direction: TransactionDirection;
  montant: string;
  category_id: string | null;
  tiers: string | null;
  reference: string | null;
  description: string | null;
};

const n = (v: string): number => {
  const x = Number((v ?? "").trim().replace(",", "."));
  return Number.isFinite(x) ? x : 0;
};

export async function saveTransaction(id: string | null, input: TransactionInput): Promise<ActionResult> {
  const montant = n(input.montant);
  if (montant <= 0) return { ok: false, error: "Le montant doit être supérieur à 0." };
  if (input.direction !== "in" && input.direction !== "out")
    return { ok: false, error: "Sens de la transaction invalide." };

  const data = {
    date: input.date,
    direction: input.direction,
    montant,
    category_id: input.category_id || null,
    tiers: input.tiers?.trim() || null,
    reference: input.reference?.trim() || null,
    description: input.description?.trim() || null,
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("transactions").update(data).eq("id", id)
    : await supabase.from("transactions").insert(data);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tresorerie");
  return { ok: true };
}

export async function deleteTransactions(ids: string[]): Promise<ActionResult> {
  if (ids.length === 0) return { ok: true };
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").delete().in("id", ids);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tresorerie");
  return { ok: true };
}
