import { PageHeader } from "@/components/layout/page-header";
import { SupabaseNotice } from "@/components/layout/supabase-notice";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getClientsAndProducts } from "@/lib/data/catalog";
import type { Prospect } from "@/lib/supabase/types";
import { DevisEditor } from "@/components/devis/devis-editor";

export const metadata = { title: "Nouveau devis · AscoSys" };

export default async function NouveauDevisPage({ searchParams }: { searchParams: Promise<{ prospect?: string }> }) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-7">
        <PageHeader title="Nouveau devis" />
        <SupabaseNotice />
      </div>
    );
  }
  const { prospect } = await searchParams;
  const supabase = await createClient();
  const [{ data: prospects }, { products }] = await Promise.all([
    supabase.from("prospects").select("*").order("name"),
    getClientsAndProducts(),
  ]);
  return <DevisEditor prospects={(prospects ?? []) as Prospect[]} products={products} defaultProspectId={prospect} />;
}
