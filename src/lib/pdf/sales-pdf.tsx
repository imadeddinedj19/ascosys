import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  SalesDocumentPDF,
  type PdfClient,
  type PdfLine,
  type PdfDocument,
  type PdfVariant,
} from "@/components/pdf/sales-document-pdf";

/**
 * Génère le PDF d'un document de vente.
 *  - kind "facture" → facture chiffrée.
 *  - kind "bon"     → bon de livraison ; s'il s'agit d'une facture, on imprime le
 *                     bon de livraison facturé (quantités seulement), sinon le bon chiffré.
 */
export async function buildSalesPdf(
  id: string,
  kind: "facture" | "bon",
): Promise<Response> {
  if (!isSupabaseConfigured()) {
    return new Response("Base de données non connectée.", { status: 400 });
  }

  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("sales_documents")
    .select("*")
    .eq("id", id)
    .single();
  if (!doc) return new Response("Document introuvable.", { status: 404 });

  const [{ data: lines }, { data: client }] = await Promise.all([
    supabase.from("sales_document_lines").select("*").eq("document_id", id).order("position"),
    supabase.from("clients").select("*").eq("id", doc.client_id).single(),
  ]);

  if (!client) return new Response("Client introuvable.", { status: 404 });

  const pdfDoc: PdfDocument = {
    numero: doc.numero,
    date: doc.date,
    type: doc.type,
    tva_rate: doc.tva_rate,
    total_ht: doc.total_ht,
    total_tva: doc.total_tva,
    timbre: doc.timbre ?? 0,
    total_ttc: doc.total_ttc,
    notes: doc.notes,
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
  const pdfLines: PdfLine[] = (lines ?? []).map((l) => ({
    designation: l.designation,
    quantite: l.quantite,
    prix_unitaire: l.prix_unitaire,
    total_ht: l.total_ht,
  }));

  // Le bon de livraison d'une facture n'affiche pas les prix.
  const variant: PdfVariant =
    kind === "facture" ? "facture" : doc.type === "facture" ? "bon-facture" : "bon";

  const buffer = await renderToBuffer(
    <SalesDocumentPDF doc={pdfDoc} client={pdfClient} lines={pdfLines} variant={variant} />,
  );

  const prefix = kind === "facture" ? "Facture" : "BL";
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${prefix}-${doc.numero}.pdf"`,
    },
  });
}
