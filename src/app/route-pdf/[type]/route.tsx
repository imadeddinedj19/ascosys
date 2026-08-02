/**
 * Endpoint POST éphémère : reçoit un payload (JSON dans un champ de formulaire)
 * décrivant une facture / BL de route et renvoie directement le PDF — aucune
 * insertion dans sales_documents. Les prix fictifs sont mémorisés (upsert dans
 * fictive_prices) si le payload le demande.
 */
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { droitTimbreSiEspeces } from "@/lib/fiscal";
import {
  SalesDocumentPDF,
  type PdfClient,
  type PdfLine,
  type PdfDocument,
  type PdfVariant,
} from "@/components/pdf/sales-document-pdf";
import type { PaymentMode } from "@/lib/supabase/types";

export const runtime = "nodejs";

type PayloadLine = {
  product_id: string | null;
  designation: string;
  quantite: number;
  prix_unitaire: number;
};

type Payload = {
  clientId: string;
  numero: string;
  date: string;
  tva_rate: number;
  paiement_mode: PaymentMode | null;
  notes: string | null;
  save_prices: boolean;
  lines: PayloadLine[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function badRequest(msg: string) {
  return new Response(msg, { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params;
  if (type !== "facture" && type !== "bon") return badRequest("Type de document invalide.");
  if (!isSupabaseConfigured()) return badRequest("Base de données non connectée.");

  const form = await req.formData();
  const raw = form.get("payload");
  if (typeof raw !== "string") return badRequest("Payload manquant.");

  let payload: Payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return badRequest("Payload illisible.");
  }
  if (!payload.clientId) return badRequest("Client manquant.");
  if (!Array.isArray(payload.lines) || payload.lines.length === 0)
    return badRequest("Aucune ligne à générer.");

  const supabase = await createClient();

  // Enregistrement des prix fictifs (upsert) avant génération du PDF.
  if (payload.save_prices) {
    const rows = payload.lines
      .filter((l) => l.product_id && Number(l.prix_unitaire) > 0)
      .map((l) => ({
        client_id: payload.clientId,
        product_id: l.product_id as string,
        prix_unitaire: round2(Number(l.prix_unitaire)),
      }));
    if (rows.length > 0) {
      await supabase
        .from("fictive_prices")
        .upsert(rows, { onConflict: "client_id,product_id" });
    }
  }

  const { data: client } = await supabase
    .from("clients")
    .select("company_name, client_type, address, rc, carte_artisan, nif, art, nis, phone")
    .eq("id", payload.clientId)
    .single();
  if (!client) return badRequest("Client introuvable.");

  const isFacture = type === "facture";
  const tvaRate = isFacture ? Number(payload.tva_rate) || 0 : 0;
  const lines = payload.lines.map((l) => {
    const qte = Number(l.quantite) || 0;
    const pu = Number(l.prix_unitaire) || 0;
    return {
      designation: (l.designation ?? "").trim() || "—",
      quantite: qte,
      prix_unitaire: pu,
      total_ht: round2(qte * pu),
    };
  });
  const totalHt = round2(lines.reduce((s, l) => s + l.total_ht, 0));
  const totalTva = round2(totalHt * tvaRate);
  const ttcBase = round2(totalHt + totalTva);
  const paiementMode = isFacture ? payload.paiement_mode ?? null : null;
  const timbre = isFacture ? droitTimbreSiEspeces(ttcBase, paiementMode) : 0;
  const totalTtc = round2(ttcBase + timbre);

  const pdfDoc: PdfDocument = {
    numero: (payload.numero ?? "").trim() || "—",
    date: payload.date,
    type: isFacture ? "facture" : "bon",
    tva_rate: tvaRate,
    total_ht: totalHt,
    total_tva: totalTva,
    timbre,
    total_ttc: totalTtc,
    notes: payload.notes,
  };
  const pdfClient: PdfClient = {
    company_name: client.company_name,
    client_type: client.client_type,
    address: client.address,
    rc: client.rc,
    carte_artisan: client.carte_artisan,
    nif: client.nif,
    art: client.art,
    nis: client.nis,
    phone: client.phone,
  };
  const pdfLines: PdfLine[] = lines;
  const variant: PdfVariant = isFacture ? "facture" : "bon";

  const buffer = await renderToBuffer(
    <SalesDocumentPDF doc={pdfDoc} client={pdfClient} lines={pdfLines} variant={variant} />,
  );

  const prefix = isFacture ? "Facture-Route" : "BL-Route";
  const safeNumero = pdfDoc.numero.replace(/[^\w\-\.]/g, "_");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${prefix}-${safeNumero}.pdf"`,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
