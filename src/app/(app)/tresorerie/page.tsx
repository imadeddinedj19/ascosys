import { PageHeader } from "@/components/layout/page-header";
import { SupabaseNotice } from "@/components/layout/supabase-notice";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Transaction, TransactionCategory } from "@/lib/supabase/types";
import { TresorerieView } from "./tresorerie-view";

export const metadata = { title: "Trésorerie · AscoSys" };

async function getData(): Promise<{
  transactions: Transaction[];
  categories: TransactionCategory[];
} | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const [{ data: transactions }, { data: categories }] = await Promise.all([
    supabase.from("transactions").select("*").order("date", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("transaction_categories").select("*").order("sort_order"),
  ]);
  return { transactions: transactions ?? [], categories: categories ?? [] };
}

export default async function TresoreriePage() {
  const data = await getData();
  if (data === null) {
    return (
      <div className="space-y-7">
        <PageHeader title="Trésorerie" description="Dépenses, salaires, achats fournisseurs et entrées diverses" />
        <SupabaseNotice />
      </div>
    );
  }
  return <TresorerieView transactions={data.transactions} categories={data.categories} />;
}
