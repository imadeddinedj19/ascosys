import { PageHeader } from "@/components/layout/page-header";
import { SupabaseNotice } from "@/components/layout/supabase-notice";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { SalesDocument, Client } from "@/lib/supabase/types";
import { DocumentsList } from "../ventes/ventes-list";

export const metadata = { title: "Bons de livraison · AscoSys" };

export default async function BonsLivraisonPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-7">
        <PageHeader title="Bons de livraison" description="Bons de livraison (sans TVA)" />
        <SupabaseNotice />
      </div>
    );
  }
  const supabase = await createClient();
  const [{ data: documents }, { data: clients }] = await Promise.all([
    supabase.from("sales_documents").select("*").eq("type", "bon").order("date", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("clients").select("*").order("company_name"),
  ]);
  return <DocumentsList mode="bon" documents={(documents ?? []) as SalesDocument[]} clients={(clients ?? []) as Client[]} />;
}
