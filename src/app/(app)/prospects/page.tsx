import { PageHeader } from "@/components/layout/page-header";
import { SupabaseNotice } from "@/components/layout/supabase-notice";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Prospect } from "@/lib/supabase/types";
import { ProspectsView } from "./prospects-view";

export const metadata = { title: "Prospects · AscoSys" };

export default async function ProspectsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-7">
        <PageHeader title="Prospects" description="Pistes commerciales (avant conversion en client)" />
        <SupabaseNotice />
      </div>
    );
  }
  const supabase = await createClient();
  const [{ data: prospects }, { data: devisCounts }] = await Promise.all([
    supabase.from("prospects").select("*").order("created_at", { ascending: false }),
    supabase.from("proformas").select("prospect_id"),
  ]);
  const counts: Record<string, number> = {};
  for (const d of devisCounts ?? []) if (d.prospect_id) counts[d.prospect_id] = (counts[d.prospect_id] ?? 0) + 1;
  return <ProspectsView prospects={(prospects ?? []) as Prospect[]} devisCounts={counts} />;
}
