import { PageHeader } from "@/components/layout/page-header";
import { SupabaseNotice } from "@/components/layout/supabase-notice";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Proforma, Prospect } from "@/lib/supabase/types";
import { DevisList } from "./devis-list";

export const metadata = { title: "Devis / Proforma · AscoSys" };

export default async function DevisPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-7">
        <PageHeader title="Devis / Proforma" description="Devis aux prospects" />
        <SupabaseNotice />
      </div>
    );
  }
  const supabase = await createClient();
  const [{ data: proformas }, { data: prospects }] = await Promise.all([
    supabase.from("proformas").select("*").order("date", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("prospects").select("id, name"),
  ]);
  return <DevisList proformas={(proformas ?? []) as Proforma[]} prospects={(prospects ?? []) as Pick<Prospect, "id" | "name">[]} />;
}
