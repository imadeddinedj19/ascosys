"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type ProductInput = {
  name: string;
  ref: string | null;
  client_id: string | null;
  forme_id: string | null;
  trace: string | null; // chemin du PDF de tracé
  active: boolean;
};

const t = (v: string | null) => (v && v.trim() ? v.trim() : null);

export async function saveProduct(id: string | null, input: ProductInput): Promise<ActionResult> {
  if (!input.name?.trim()) return { ok: false, error: "La désignation est obligatoire." };
  const data = {
    name: input.name.trim(),
    ref: t(input.ref),
    client_id: input.client_id || null,
    forme_id: input.forme_id || null,
    trace: t(input.trace),
    active: input.active,
  };
  const supabase = await createClient();
  const query = id
    ? supabase.from("products").update(data).eq("id", id)
    : supabase.from("products").insert(data);
  const { error } = await query;
  if (error) return { ok: false, error: error.message };
  revalidatePath("/produits");
  return { ok: true };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  return deleteProducts([id]);
}

export async function deleteProducts(ids: string[]): Promise<ActionResult> {
  if (ids.length === 0) return { ok: true };
  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().in("id", ids);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/produits");
  return { ok: true };
}
