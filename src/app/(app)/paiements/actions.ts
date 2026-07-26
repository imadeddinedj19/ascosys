"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PaymentMode } from "@/lib/supabase/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type PaymentInput = {
  client_id: string;
  document_id: string | null;
  date: string;
  montant: string;
  mode: PaymentMode;
  reference: string | null;
  note: string | null;
};

const n = (v: string): number => {
  const x = Number((v ?? "").trim().replace(",", "."));
  return Number.isFinite(x) ? x : 0;
};

export async function savePayment(id: string | null, input: PaymentInput): Promise<ActionResult> {
  if (!input.client_id) return { ok: false, error: "Veuillez sélectionner un client." };
  const montant = n(input.montant);
  if (montant <= 0) return { ok: false, error: "Le montant doit être supérieur à 0." };

  const data = {
    client_id: input.client_id,
    document_id: input.document_id || null,
    date: input.date,
    montant,
    mode: input.mode,
    reference: input.reference?.trim() || null,
    note: input.note?.trim() || null,
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("payments").update(data).eq("id", id)
    : await supabase.from("payments").insert(data);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/paiements");
  return { ok: true };
}

export async function deletePayments(ids: string[]): Promise<ActionResult> {
  if (ids.length === 0) return { ok: true };
  const supabase = await createClient();
  const { error } = await supabase.from("payments").delete().in("id", ids);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/paiements");
  return { ok: true };
}

/** Solde d'ouverture = dette réelle du client au démarrage du CRM (hors historique importé). */
export async function updateOpeningBalance(clientId: string, value: string): Promise<ActionResult> {
  const montant = Number((value ?? "").trim().replace(",", "."));
  if (!Number.isFinite(montant)) return { ok: false, error: "Montant invalide." };
  const supabase = await createClient();
  const { error } = await supabase.from("clients").update({ solde_ouverture: montant }).eq("id", clientId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/paiements");
  return { ok: true };
}
