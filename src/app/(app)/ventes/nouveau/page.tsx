import { PageHeader } from "@/components/layout/page-header";
import { SupabaseNotice } from "@/components/layout/supabase-notice";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getClientsAndProducts } from "@/lib/data/catalog";
import { DocumentEditor, type EditorMode } from "@/components/ventes/document-editor";

export const metadata = { title: "Nouveau document · AscoSys" };

export default async function NouvelleVentePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const mode: EditorMode = type === "bon" ? "bon" : "facture";

  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-7">
        <PageHeader title={mode === "bon" ? "Nouveau bon de livraison" : "Nouvelle facture"} />
        <SupabaseNotice />
      </div>
    );
  }
  const { clients, products, overrides } = await getClientsAndProducts();
  return <DocumentEditor mode={mode} clients={clients} products={products} overrides={overrides} />;
}
