"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type PriceInput = {
  prix_unitaire: string;
  client_id: string | null; // null / "" = prix général
  valid_from: string;
};

const n = (v: string): number | null => {
  const t = (v ?? "").trim().replace(",", ".");
  if (t === "") return null;
  const x = Number(t);
  return Number.isFinite(x) ? x : null;
};

export async function savePrice(productId: string, input: PriceInput): Promise<ActionResult> {
  const prix = n(input.prix_unitaire);
  if (prix === null) return { ok: false, error: "Le prix unitaire est obligatoire." };
  const data = {
    product_id: productId,
    client_id: input.client_id || null,
    prix_unitaire: prix,
    valid_from: input.valid_from || new Date().toISOString().slice(0, 10),
  };
  const supabase = await createClient();
  const { error } = await supabase.from("product_prices").insert(data);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tarification");
  return { ok: true };
}

export async function deletePrice(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("product_prices").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tarification");
  return { ok: true };
}
