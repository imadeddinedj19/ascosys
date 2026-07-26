import { PageHeader } from "@/components/layout/page-header";
import { SupabaseNotice } from "@/components/layout/supabase-notice";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Forme } from "@/lib/supabase/types";
import { FormesView } from "./formes-view";

export const metadata = { title: "Formes de découpe · AscoSys" };

async function getFormes(): Promise<Forme[] | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("formes").select("*").order("ref");
  return data ?? [];
}

export default async function FormesPage() {
  const formes = await getFormes();
  if (formes === null) {
    return (
      <div className="space-y-7">
        <PageHeader title="Formes de découpe" description="Catalogue des formes (Lmoule)" />
        <SupabaseNotice />
      </div>
    );
  }
  return <FormesView initialFormes={formes} />;
}
