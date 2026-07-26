import { PageHeader } from "@/components/layout/page-header";
import { SupabaseNotice } from "@/components/layout/supabase-notice";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { buildClientStatement } from "@/lib/data/statement";
import type { Client } from "@/lib/supabase/types";
import { SituationClientView } from "./situation-client-view";

export const metadata = { title: "Situation client · AscoSys" };

export default async function SituationClientPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; year?: string }>;
}) {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-7">
        <PageHeader title="Situation client" description="Relevé de compte par client" />
        <SupabaseNotice />
      </div>
    );
  }

  const { client: clientId, year } = await searchParams;
  const y = year ? Number(year) : new Date().getFullYear();

  const supabase = await createClient();
  const { data: clients } = await supabase.from("clients").select("*").order("company_name");
  const statement = clientId ? await buildClientStatement(clientId, y) : null;

  return (
    <SituationClientView
      clients={(clients ?? []) as Client[]}
      selectedClientId={clientId ?? ""}
      year={y}
      statement={statement}
    />
  );
}
