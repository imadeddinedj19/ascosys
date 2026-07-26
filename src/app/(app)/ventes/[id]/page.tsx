import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { SupabaseNotice } from "@/components/layout/supabase-notice";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getClientsAndProducts } from "@/lib/data/catalog";
import { DocumentEditor, type EditorDocument } from "@/components/ventes/document-editor";
import type { SalesDocument, SalesDocumentLine } from "@/lib/supabase/types";

export const metadata = { title: "Document · AscoSys" };

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-7">
        <PageHeader title="Document" />
        <SupabaseNotice />
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: doc }, { data: lines }] = await Promise.all([
    supabase.from("sales_documents").select("*").eq("id", id).single<SalesDocument>(),
    supabase.from("sales_document_lines").select("*").eq("document_id", id).order("position").returns<SalesDocumentLine[]>(),
  ]);
  if (!doc) notFound();

  const { clients, products, overrides } = await getClientsAndProducts();

  const initial: EditorDocument = {
    id: doc.id,
    numero: doc.numero,
    date: doc.date,
    client_id: doc.client_id,
    type: doc.type,
    tva_rate: doc.tva_rate,
    paiement_mode: doc.paiement_mode,
    statut: doc.statut,
    notes: doc.notes,
    lines: (lines ?? []).map((l) => ({
      product_id: l.product_id ?? "",
      designation: l.designation,
      quantite: String(l.quantite),
      prix_unitaire: String(l.prix_unitaire),
    })),
  };

  return <DocumentEditor mode={doc.type} clients={clients} products={products} overrides={overrides} initial={initial} />;
}
