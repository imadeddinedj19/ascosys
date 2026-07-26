import { PageHeader } from "@/components/layout/page-header";
import { SupabaseNotice } from "@/components/layout/supabase-notice";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { TransactionCategory } from "@/lib/supabase/types";
import { ParametresView } from "./parametres-view";

export const metadata = { title: "Paramètres · AscoSys" };

export default async function ParametresPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-7">
        <PageHeader title="Paramètres" description="Listes et libellés personnalisables" />
        <SupabaseNotice />
      </div>
    );
  }
  const supabase = await createClient();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [{ data: cats }, { data: fc }, { data: bc }] = await Promise.all([
    supabase.from("transaction_categories").select("*").order("sort_order"),
    supabase.from("facture_counters").select("last").eq("year", year).maybeSingle(),
    supabase.from("bl_counters").select("last").eq("year", year).eq("month", month).maybeSingle(),
  ]);

  return (
    <ParametresView
      categories={(cats ?? []) as TransactionCategory[]}
      factureLast={fc?.last ?? 0}
      blLast={bc?.last ?? 0}
      year={year}
      month={month}
    />
  );
}
