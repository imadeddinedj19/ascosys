import { PageHeader } from "@/components/layout/page-header";
import { SupabaseNotice } from "@/components/layout/supabase-notice";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Product, Client, Forme } from "@/lib/supabase/types";
import { ProduitsView } from "./produits-view";

export const metadata = { title: "Produits · AscoSys" };

async function getData(): Promise<{ products: Product[]; clients: Client[]; formes: Forme[] } | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const [{ data: products }, { data: clients }, { data: formes }] = await Promise.all([
    supabase.from("products").select("*").order("name"),
    supabase.from("clients").select("*").order("company_name"),
    supabase.from("formes").select("*").order("ref"),
  ]);
  return { products: products ?? [], clients: clients ?? [], formes: formes ?? [] };
}

export default async function ProduitsPage() {
  const data = await getData();
  if (data === null) {
    return (
      <div className="space-y-7">
        <PageHeader title="Produits" description="Catalogue des produits fabriqués" />
        <SupabaseNotice />
      </div>
    );
  }
  return <ProduitsView products={data.products} clients={data.clients} formes={data.formes} />;
}
