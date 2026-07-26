"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ProformaStatut, PaymentMode, OrderShift } from "@/lib/supabase/types";

export type ActionResult = { ok: true; id: string } | { ok: false; error: string };
export type SimpleResult = { ok: true } | { ok: false; error: string };

export type DevisLineInput = {
  product_id: string | null;
  designation: string;
  quantite: string;
  prix_unitaire: string;
};

export type DevisHeader = {
  prospect_id: string;
  date: string;
  tva_rate: string;
  statut: ProformaStatut;
  notes: string | null;
};

const num = (v: string): number => {
  const x = Number((v ?? "").trim().replace(",", "."));
  return Number.isFinite(x) ? x : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

export async function saveProforma(id: string | null, header: DevisHeader, lines: DevisLineInput[]): Promise<ActionResult> {
  if (!header.prospect_id) return { ok: false, error: "Veuillez sélectionner un prospect." };

  const cleanLines = lines
    .map((l, i) => ({
      product_id: l.product_id || null,
      designation: l.designation.trim(),
      quantite: num(l.quantite),
      prix_unitaire: num(l.prix_unitaire),
      total_ht: round2(num(l.quantite) * num(l.prix_unitaire)),
      position: i,
    }))
    .filter((l) => l.designation !== "");
  if (cleanLines.length === 0) return { ok: false, error: "Ajoutez au moins une ligne." };

  const tvaRate = num(header.tva_rate);
  const totalHt = round2(cleanLines.reduce((s, l) => s + l.total_ht, 0));
  const totalTva = round2(totalHt * tvaRate);
  const totalTtc = round2(totalHt + totalTva);

  const supabase = await createClient();
  let proformaId = id;
  const headerData = {
    prospect_id: header.prospect_id,
    date: header.date,
    tva_rate: tvaRate,
    statut: header.statut,
    notes: header.notes?.trim() || null,
    total_ht: totalHt,
    total_tva: totalTva,
    total_ttc: totalTtc,
  };

  if (id) {
    const { error } = await supabase.from("proformas").update(headerData).eq("id", id);
    if (error) return { ok: false, error: error.message };
    await supabase.from("proforma_lines").delete().eq("proforma_id", id);
  } else {
    const { data: numero, error: numErr } = await supabase.rpc("next_proforma_numero");
    if (numErr) return { ok: false, error: numErr.message };
    const { data, error } = await supabase.from("proformas").insert({ numero: numero as string, ...headerData }).select("id").single();
    if (error) return { ok: false, error: error.message };
    proformaId = data!.id;
  }

  const { error: linesErr } = await supabase
    .from("proforma_lines")
    .insert(cleanLines.map((l) => ({ ...l, proforma_id: proformaId! })));
  if (linesErr) return { ok: false, error: linesErr.message };

  revalidatePath("/devis");
  return { ok: true, id: proformaId! };
}

export async function deleteProformas(ids: string[]): Promise<SimpleResult> {
  if (ids.length === 0) return { ok: true };
  const supabase = await createClient();
  const { error } = await supabase.from("proformas").delete().in("id", ids);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/devis");
  return { ok: true };
}

export type DepositInput = { date: string; montant: string; mode: PaymentMode; note: string | null };

export async function addDeposit(prospectId: string, proformaId: string, input: DepositInput): Promise<SimpleResult> {
  const montant = num(input.montant);
  if (montant <= 0) return { ok: false, error: "Le montant doit être supérieur à 0." };
  const supabase = await createClient();
  const { error } = await supabase.from("prospect_deposits").insert({
    prospect_id: prospectId, proforma_id: proformaId, date: input.date, montant, mode: input.mode, note: input.note?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/devis/${proformaId}`);
  return { ok: true };
}

export async function deleteDeposit(id: string, proformaId: string): Promise<SimpleResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("prospect_deposits").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/devis/${proformaId}`);
  return { ok: true };
}

/**
 * Valide un devis : crée le client (à partir du prospect), les produits manquants,
 * les commandes en file d'attente, et reporte les acomptes en paiements du client.
 */
export async function validateProforma(id: string, queue: { date_prevue: string; shift: OrderShift }): Promise<SimpleResult> {
  const supabase = await createClient();

  const { data: prof } = await supabase.from("proformas").select("*").eq("id", id).single();
  if (!prof) return { ok: false, error: "Devis introuvable." };
  const { data: lines } = await supabase.from("proforma_lines").select("*").eq("proforma_id", id).order("position");
  const { data: prospect } = prof.prospect_id
    ? await supabase.from("prospects").select("*").eq("id", prof.prospect_id).single()
    : { data: null };

  // 1. Client (réutilise celui déjà lié, sinon crée à partir du prospect)
  let clientId = prof.client_id as string | null;
  if (!clientId) {
    if (!prospect) return { ok: false, error: "Aucun prospect à convertir." };
    if (prospect.client_id) {
      clientId = prospect.client_id;
    } else {
      const { data: newClient, error: cErr } = await supabase.from("clients").insert({
        company_name: prospect.name,
        contact_person: prospect.contact_person,
        phone: prospect.phone,
        email: prospect.email,
        industry_type: prospect.industry_type,
        client_type: "entreprise",
      }).select("id").single();
      if (cErr) return { ok: false, error: cErr.message };
      clientId = newClient!.id;
      await supabase.from("prospects").update({ client_id: clientId, status: "gagne" }).eq("id", prospect.id);
    }
  }

  // 2. Produits manquants + 3. Commandes en file d'attente
  const { data: last } = await supabase.from("order_queue").select("priority").eq("shift", queue.shift).order("priority", { ascending: false }).limit(1).maybeSingle();
  let priority = (last?.priority ?? 0) + 1;

  for (const l of lines ?? []) {
    let productId = l.product_id as string | null;
    if (!productId) {
      const { data: newProd } = await supabase.from("products").insert({ name: l.designation, client_id: clientId }).select("id").single();
      productId = newProd?.id ?? null;
      if (productId) await supabase.from("proforma_lines").update({ product_id: productId }).eq("id", l.id);
    }
    await supabase.from("order_queue").insert({
      client_id: clientId,
      product_id: productId,
      designation: l.designation,
      quantite: l.quantite,
      date_prevue: queue.date_prevue || null,
      shift: queue.shift,
      priority: priority++,
      statut: "en_attente",
      proforma_id: id,
    });
  }

  // 4. Reporte les acomptes du prospect en paiements du client
  if (prof.prospect_id) {
    const { data: deposits } = await supabase.from("prospect_deposits").select("*").eq("prospect_id", prof.prospect_id);
    for (const d of deposits ?? []) {
      await supabase.from("payments").insert({
        client_id: clientId, date: d.date, montant: d.montant, mode: d.mode,
        note: `Acompte devis ${prof.numero}`,
      });
    }
    if ((deposits ?? []).length > 0) await supabase.from("prospect_deposits").delete().eq("prospect_id", prof.prospect_id);
  }

  // 5. Devis validé
  await supabase.from("proformas").update({ statut: "valide", client_id: clientId }).eq("id", id);

  revalidatePath("/devis");
  revalidatePath("/prospects");
  revalidatePath("/clients");
  revalidatePath("/produits");
  revalidatePath("/commande-en-instance");
  revalidatePath("/paiements");
  return { ok: true };
}
