"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/supabase/types";

export type ClientInput = Omit<Client, "id" | "created_at" | "solde_ouverture">;

export type ActionResult = { ok: true } | { ok: false; error: string };

function clean(input: ClientInput): ClientInput {
  const trimmed = <T,>(v: T) => (typeof v === "string" ? (v.trim() || null) : v);
  const type: ClientInput["client_type"] =
    input.client_type === "artisan" || input.client_type === "particulier"
      ? input.client_type
      : "entreprise";
  return {
    company_name: (input.company_name ?? "").trim(),
    contact_person: trimmed(input.contact_person),
    client_type: type,
    // On ne garde le RC que pour une entreprise, la carte d'artisan que pour un artisan.
    rc: type === "entreprise" ? trimmed(input.rc) : null,
    carte_artisan: type === "artisan" ? trimmed(input.carte_artisan) : null,
    nif: type === "particulier" ? null : trimmed(input.nif),
    art: type === "particulier" ? null : trimmed(input.art),
    nis: type === "particulier" ? null : trimmed(input.nis),
    address: trimmed(input.address),
    phone: trimmed(input.phone),
    email: trimmed(input.email),
    industry_type: trimmed(input.industry_type),
    notes: trimmed(input.notes),
  } as ClientInput;
}

export async function saveClient(
  id: string | null,
  input: ClientInput,
): Promise<ActionResult> {
  const data = clean(input);
  if (!data.company_name) return { ok: false, error: "Le nom / raison sociale est obligatoire." };

  const supabase = await createClient();
  const query = id
    ? supabase.from("clients").update(data).eq("id", id)
    : supabase.from("clients").insert(data);

  const { error } = await query;
  if (error) return { ok: false, error: error.message };

  revalidatePath("/clients");
  return { ok: true };
}

export async function deleteClient(id: string): Promise<ActionResult> {
  return deleteClients([id]);
}

export async function deleteClients(ids: string[]): Promise<ActionResult> {
  if (ids.length === 0) return { ok: true };
  const supabase = await createClient();
  const { error } = await supabase.from("clients").delete().in("id", ids);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/clients");
  return { ok: true };
}
