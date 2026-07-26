import { PageHeader } from "@/components/layout/page-header";
import { SupabaseNotice } from "@/components/layout/supabase-notice";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Client } from "@/lib/supabase/types";
import { ClientsView } from "./clients-view";

export const metadata = { title: "Clients · AscoSys" };

async function getClients(): Promise<Client[] | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("*").order("company_name");
  return data ?? [];
}

export default async function ClientsPage() {
  const clients = await getClients();

  if (clients === null) {
    return (
      <div className="space-y-7">
        <PageHeader title="Clients" description="Répertoire des clients de l'entreprise" />
        <SupabaseNotice />
      </div>
    );
  }

  return <ClientsView initialClients={clients} />;
}
