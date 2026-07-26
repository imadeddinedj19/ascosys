import { PageHeader } from "@/components/layout/page-header";
import { SupabaseNotice } from "@/components/layout/supabase-notice";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { SalesDocument, Client } from "@/lib/supabase/types";
import { DocumentsList } from "../ventes/ventes-list";

export const metadata = { title: "Factures · AscoSys" };

export default async function FacturesPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-7">
        <PageHeader title="Factures" description="Factures (TVA + droit de timbre)" />
        <SupabaseNotice />
      </div>
    );
  }
  const supabase = await createClient();
  const [{ data: documents }, { data: clients }] = await Promise.all([
    supabase.from("sales_documents").select("*").eq("type", "facture").order("date", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("clients").select("*").order("company_name"),
  ]);
  return <DocumentsList mode="facture" documents={(documents ?? []) as SalesDocument[]} clients={(clients ?? []) as Client[]} />;
}
