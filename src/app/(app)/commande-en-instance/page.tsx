import { PageHeader } from "@/components/layout/page-header";
import { SupabaseNotice } from "@/components/layout/supabase-notice";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { OrderQueue, Client, Product } from "@/lib/supabase/types";
import { CommandeEnInstanceView } from "./commande-view";

export const metadata = { title: "Commande en instance · AscoSys" };

export default async function CommandeEnInstancePage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-7">
        <PageHeader title="Commande en instance" description="File d'attente de production" />
        <SupabaseNotice />
      </div>
    );
  }
  const supabase = await createClient();
  const [{ data: orders }, { data: clients }, { data: products }] = await Promise.all([
    supabase.from("order_queue").select("*").order("priority", { ascending: true }),
    supabase.from("clients").select("*").order("company_name"),
    supabase.from("products").select("id, name, active").order("name"),
  ]);
  return (
    <CommandeEnInstanceView
      orders={(orders ?? []) as OrderQueue[]}
      clients={(clients ?? []) as Client[]}
      products={(products ?? []) as Pick<Product, "id" | "name">[]}
    />
  );
}
