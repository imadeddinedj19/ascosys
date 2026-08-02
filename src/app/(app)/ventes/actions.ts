"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { droitTimbreSiEspeces } from "@/lib/fiscal";
import type { SalesDocumentType, SalesDocumentStatut, PaymentMode } from "@/lib/supabase/types";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export type DeleteResult = { ok: true } | { ok: false; error: string };

export type LineInput = {
  product_id: string | null;
  designation: string;
  quantite: string;
  prix_unitaire: string;
};

export type DocumentInput = {
  date: string;
  client_id: string;
  type: SalesDocumentType;
  tva_rate: string;
  statut: SalesDocumentStatut;
  paiement_mode: PaymentMode | ""; // facture : mode de règlement (déclenche le timbre en espèces)
  paye_livraison: string; // bon : montant payé à la livraison
  notes: string | null;
};

const num = (v: string): number => {
  const t = (v ?? "").trim().replace(",", ".");
  const x = Number(t);
  return Number.isFinite(x) ? x : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

export async function saveDocument(
  id: string | null,
  header: DocumentInput,
  lines: LineInput[],
): Promise<ActionResult> {
  if (!header.client_id) return { ok: false, error: "Veuillez sélectionner un client." };

  const cleanLines = lines
    .map((l, i) => ({
      product_id: l.product_id || null,
      designation: l.designation.trim(),
      quantite: num(l.quantite),
      prix_unitaire: num(l.prix_unitaire),
      total_ht: round2(num(l.quantite) * num(l.prix_unitaire)),
      position: i,
    }))
    .filter((l) => l.designation !== "" && l.quantite > 0);

  if (cleanLines.length === 0)
    return { ok: false, error: "Ajoutez au moins une ligne (désignation + quantité)." };

  const isFacture = header.type === "facture";
  const tvaRate = isFacture ? num(header.tva_rate) : 0;
  const totalHt = round2(cleanLines.reduce((s, l) => s + l.total_ht, 0));
  const totalTva = round2(totalHt * tvaRate);
  const ttcBase = round2(totalHt + totalTva);
  const paiementMode = isFacture ? (header.paiement_mode || null) : null;
  const timbre = isFacture ? droitTimbreSiEspeces(ttcBase, paiementMode) : 0;
  const totalTtc = round2(ttcBase + timbre);

  const supabase = await createClient();
  let documentId = id;

  if (id) {
    const { error } = await supabase
      .from("sales_documents")
      .update({
        date: header.date,
        client_id: header.client_id,
        type: header.type,
        tva_rate: tvaRate,
        statut: header.statut,
        paiement_mode: paiementMode,
        notes: header.notes?.trim() || null,
        total_ht: totalHt,
        total_tva: totalTva,
        timbre,
        total_ttc: totalTtc,
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    await supabase.from("sales_document_lines").delete().eq("document_id", id);
  } else {
    // Attribue le numéro selon le type : facture N/YY, bon N/MM/YY.
    const { data: numero, error: numErr } = await supabase.rpc(
      isFacture ? "next_facture_numero" : "next_bl_numero",
    );
    if (numErr) return { ok: false, error: numErr.message };

    const { data, error } = await supabase
      .from("sales_documents")
      .insert({
        numero: numero as string,
        date: header.date,
        client_id: header.client_id,
        type: header.type,
        tva_rate: tvaRate,
        statut: header.statut,
        paiement_mode: paiementMode,
        notes: header.notes?.trim() || null,
        total_ht: totalHt,
        total_tva: totalTva,
        timbre,
        total_ttc: totalTtc,
      })
      .select("id, numero")
      .single();
    if (error) return { ok: false, error: error.message };
    documentId = data!.id;

    // Bon de livraison : paiement encaissé à la livraison → déduit du solde client.
    const payeLivraison = num(header.paye_livraison);
    if (!isFacture && payeLivraison > 0) {
      await supabase.from("payments").insert({
        client_id: header.client_id,
        document_id: documentId,
        date: header.date,
        montant: payeLivraison,
        mode: "espece",
        note: `Paiement à la livraison — BL ${data!.numero}`,
      });
    }
  }

  const { error: linesError } = await supabase
    .from("sales_document_lines")
    .insert(cleanLines.map((l) => ({ ...l, document_id: documentId! })));
  if (linesError) return { ok: false, error: linesError.message };

  // Document marqué « payé » → enregistre le règlement dans les paiements du client.
  await reconcileDocumentPayment(supabase, {
    documentId: documentId!,
    clientId: header.client_id,
    date: header.date,
    statut: header.statut,
    totalTtc,
  });

  revalidatePath("/factures");
  revalidatePath("/bons-livraison");
  revalidatePath("/paiements");
  return { ok: true, id: documentId! };
}

const AUTO_PAYE = "[AUTO-PAYE]";

/**
 * Synchronise un « règlement automatique » avec le statut du document :
 * statut = payé → crée un paiement pour le montant restant (déduit du solde) ;
 * statut ≠ payé → retire ce paiement automatique.
 * Ignoré pour les documents historiques (exclus du calcul du solde).
 */
async function reconcileDocumentPayment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  args: { documentId: string; clientId: string; date: string; statut: SalesDocumentStatut; totalTtc: number },
) {
  const { data: doc } = await supabase
    .from("sales_documents")
    .select("numero, historique, type")
    .eq("id", args.documentId)
    .single();
  if (!doc || doc.historique) return;

  // Retire l'éventuel règlement automatique existant pour repartir sur une base propre.
  await supabase.from("payments").delete().eq("document_id", args.documentId).ilike("note", `%${AUTO_PAYE}%`);

  if (args.statut !== "paye") return;

  // Montant déjà réglé manuellement pour ce document (ex. paiement à la livraison).
  const { data: manual } = await supabase.from("payments").select("montant").eq("document_id", args.documentId);
  const dejaPaye = (manual ?? []).reduce((s, p) => s + Number(p.montant), 0);
  const reste = Math.round((args.totalTtc - dejaPaye) * 100) / 100;
  if (reste <= 0) return;

  const label = doc.type === "facture" ? "Facture" : "BL";
  await supabase.from("payments").insert({
    client_id: args.clientId,
    document_id: args.documentId,
    date: args.date,
    montant: reste,
    mode: "espece",
    note: `Règlement ${label} ${doc.numero} ${AUTO_PAYE}`,
  });
}

/* ============================================================================
 * Facture / BL de route — documents éphémères (PDF à la volée, aucun stockage
 * dans sales_documents). Seuls les prix fictifs par (client, produit) sont
 * mémorisés dans la table fictive_prices pour rappel automatique au prochain BL.
 * ==========================================================================*/

/** Prix fictifs enregistrés pour un client → utilisés par la modale pour pré-remplir. */
export async function getFictivePricesForClient(clientId: string): Promise<Record<string, number>> {
  if (!clientId) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("fictive_prices")
    .select("product_id, prix_unitaire")
    .eq("client_id", clientId);
  const map: Record<string, number> = {};
  for (const row of data ?? []) map[row.product_id] = Number(row.prix_unitaire);
  return map;
}

/** Numéro suggéré pour un nouveau document (peek — ne consomme pas le compteur). */
export async function getSuggestedNumero(docType: SalesDocumentType): Promise<string> {
  const { suggestNumero } = await import("@/lib/data/numero");
  return suggestNumero(docType);
}

export async function deleteDocument(id: string): Promise<DeleteResult> {
  return deleteDocuments([id]);
}

export async function deleteDocuments(ids: string[]): Promise<DeleteResult> {
  if (ids.length === 0) return { ok: true };
  const supabase = await createClient();
  const { error } = await supabase.from("sales_documents").delete().in("id", ids);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/factures");
  revalidatePath("/bons-livraison");
  return { ok: true };
}
