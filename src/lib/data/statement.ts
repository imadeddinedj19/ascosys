import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/supabase/types";

export type StatementProductLine = {
  designation: string;
  quantite: number;
  prix_unitaire: number;
  total: number;
};

export type StatementEvent =
  | {
      kind: "order";
      date: string;
      docType: "facture" | "bon";
      numero: string;
      lines: StatementProductLine[];
      total: number; // total du document (crédit)
      balance: number;
    }
  | {
      kind: "payment";
      date: string;
      label: string;
      montant: number; // versement
      balance: number;
    };

export type ClientStatement = {
  client: Client;
  year: number;
  years: number[];
  reportANouveau: number;
  events: StatementEvent[];
  totalCredit: number; // total commandé (crédit) sur l'année
  totalVersement: number; // total payé sur l'année
  soldeFinal: number;
};

/**
 * Relevé de compte détaillé d'un client pour une année :
 * report à nouveau + commandes (avec le détail des produits) et versements,
 * dans l'ordre chronologique, avec solde courant.
 * Inclut l'historique importé pour montrer l'intégralité des commandes.
 */
export async function buildClientStatement(clientId: string, year: number): Promise<ClientStatement | null> {
  const supabase = await createClient();

  const [{ data: client }, { data: docs }, { data: pays }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", clientId).single<Client>(),
    supabase
      .from("sales_documents")
      .select("id, numero, date, type, total_ttc, statut, created_at")
      .eq("client_id", clientId)
      .neq("statut", "brouillon"),
    supabase.from("payments").select("date, montant, note, created_at").eq("client_id", clientId),
  ]);

  if (!client) return null;

  // Lignes produits de tous les documents du client.
  const docIds = (docs ?? []).map((d) => d.id);
  const linesByDoc = new Map<string, StatementProductLine[]>();
  if (docIds.length > 0) {
    const { data: lines } = await supabase
      .from("sales_document_lines")
      .select("document_id, designation, quantite, prix_unitaire, total_ht, position")
      .in("document_id", docIds)
      .order("position");
    for (const l of lines ?? []) {
      const arr = linesByDoc.get(l.document_id) ?? [];
      arr.push({ designation: l.designation, quantite: Number(l.quantite), prix_unitaire: Number(l.prix_unitaire), total: Number(l.total_ht) });
      linesByDoc.set(l.document_id, arr);
    }
  }

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  // Années disponibles d'après toutes les dates (documents + versements).
  const yearsSet = new Set<number>();
  for (const d of docs ?? []) if (d.date) yearsSet.add(Number(d.date.slice(0, 4)));
  for (const p of pays ?? []) if (p.date) yearsSet.add(Number(p.date.slice(0, 4)));
  yearsSet.add(new Date().getFullYear());
  const years = [...yearsSet].sort((a, b) => b - a);

  // Report à nouveau : commandes − versements AVANT l'année.
  let reportANouveau = 0;
  for (const d of docs ?? []) if (d.date && d.date < yearStart) reportANouveau += Number(d.total_ttc);
  for (const p of pays ?? []) if (p.date && p.date < yearStart) reportANouveau -= Number(p.montant);
  reportANouveau = Math.round(reportANouveau * 100) / 100;

  type Raw =
    | { sortKey: string; kind: "order"; date: string; docType: "facture" | "bon"; numero: string; lines: StatementProductLine[]; total: number }
    | { sortKey: string; kind: "payment"; date: string; label: string; montant: number };
  const raw: Raw[] = [];

  for (const d of docs ?? []) {
    if (!d.date || d.date < yearStart || d.date > yearEnd) continue;
    raw.push({
      sortKey: `${d.date}#${d.created_at}`,
      kind: "order",
      date: d.date,
      docType: d.type === "facture" ? "facture" : "bon",
      numero: d.numero,
      lines: linesByDoc.get(d.id) ?? [],
      total: Number(d.total_ttc),
    });
  }
  for (const p of pays ?? []) {
    if (!p.date || p.date < yearStart || p.date > yearEnd) continue;
    raw.push({
      sortKey: `${p.date}#${p.created_at}`,
      kind: "payment",
      date: p.date,
      label: (p.note ?? "").replace(/\s*\[AUTO-PAYE\]\s*/g, "").trim() || "Versement",
      montant: Number(p.montant),
    });
  }
  raw.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  let balance = reportANouveau;
  let totalCredit = 0;
  let totalVersement = 0;
  const events: StatementEvent[] = raw.map((r) => {
    if (r.kind === "order") {
      balance = Math.round((balance + r.total) * 100) / 100;
      totalCredit += r.total;
      return { kind: "order", date: r.date, docType: r.docType, numero: r.numero, lines: r.lines, total: r.total, balance };
    }
    balance = Math.round((balance - r.montant) * 100) / 100;
    totalVersement += r.montant;
    return { kind: "payment", date: r.date, label: r.label, montant: r.montant, balance };
  });

  return {
    client,
    year,
    years,
    reportANouveau,
    events,
    totalCredit: Math.round(totalCredit * 100) / 100,
    totalVersement: Math.round(totalVersement * 100) / 100,
    soldeFinal: balance,
  };
}
