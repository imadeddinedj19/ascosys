import { PageHeader } from "@/components/layout/page-header";
import { SupabaseNotice } from "@/components/layout/supabase-notice";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Product, ProductPrice, Client } from "@/lib/supabase/types";
import { TarificationView } from "./tarification-view";

export const metadata = { title: "Tarification · AscoSys" };

async function getData(): Promise<{ products: Product[]; prices: ProductPrice[]; clients: Client[] } | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const [{ data: products }, { data: prices }, { data: clients }] = await Promise.all([
    supabase.from("products").select("*").order("name"),
    supabase.from("product_prices").select("*").order("valid_from", { ascending: false }),
    supabase.from("clients").select("*").order("company_name"),
  ]);
  return { products: products ?? [], prices: prices ?? [], clients: clients ?? [] };
}

export default async function TarificationPage() {
  const data = await getData();
  if (data === null) {
    return (
      <div className="space-y-7">
        <PageHeader title="Tarification" description="Prix de vente par produit" />
        <SupabaseNotice />
      </div>
    );
  }
  return <TarificationView products={data.products} prices={data.prices} clients={data.clients} />;
}
