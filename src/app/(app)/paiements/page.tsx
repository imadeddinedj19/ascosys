import { PageHeader } from "@/components/layout/page-header";
import { SupabaseNotice } from "@/components/layout/supabase-notice";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Payment, Client, ClientBalance, SalesDocument } from "@/lib/supabase/types";
import { PaiementsView } from "./paiements-view";

export const metadata = { title: "Paiements & Solde · AscoSys" };

async function getData(): Promise<{
  payments: Payment[];
  clients: Client[];
  balances: ClientBalance[];
  documents: SalesDocument[];
} | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const [{ data: payments }, { data: clients }, { data: balances }, { data: documents }] =
    await Promise.all([
      supabase.from("payments").select("*").order("date", { ascending: false }),
      supabase.from("clients").select("*").order("company_name"),
      supabase.from("client_balance").select("*"),
      supabase.from("sales_documents").select("*").order("date", { ascending: false }),
    ]);
  return {
    payments: payments ?? [],
    clients: clients ?? [],
    balances: balances ?? [],
    documents: documents ?? [],
  };
}

export default async function PaiementsPage() {
  const data = await getData();
  if (data === null) {
    return (
      <div className="space-y-7">
        <PageHeader title="Paiements & Solde" description="Encaissements et soldes clients" />
        <SupabaseNotice />
      </div>
    );
  }
  return (
    <PaiementsView
      payments={data.payments}
      clients={data.clients}
      balances={data.balances}
      documents={data.documents}
    />
  );
}
