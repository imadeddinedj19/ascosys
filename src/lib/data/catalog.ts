import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/supabase/types";

export type ProductOption = {
  id: string;
  name: string;
  prix_unitaire: number | null; // prix général courant (client_id null)
};

/** Prix spécifique courant pour un couple (produit, client). */
export type PriceOverride = {
  product_id: string;
  client_id: string;
  prix_unitaire: number;
};

/**
 * Récupère clients + produits avec :
 *  - le prix général courant (le plus récent, sans client),
 *  - la liste des prix spécifiques courants par client (pour l'auto-remplissage des ventes).
 */
export async function getClientsAndProducts(): Promise<{
  clients: Client[];
  products: ProductOption[];
  overrides: PriceOverride[];
}> {
  const supabase = await createClient();
  const [{ data: clients }, { data: products }, { data: prices }] = await Promise.all([
    supabase.from("clients").select("*").order("company_name"),
    supabase.from("products").select("id, name").order("name"),
    supabase
      .from("product_prices")
      .select("product_id, client_id, prix_unitaire, valid_from")
      .order("valid_from", { ascending: false }),
  ]);

  // Prix général courant (client_id null) : le premier rencontré par produit (déjà trié desc).
  const general = new Map<string, number>();
  // Prix spécifique courant par (produit, client).
  const overrideMap = new Map<string, PriceOverride>();

  for (const p of prices ?? []) {
    if (p.client_id == null) {
      if (!general.has(p.product_id)) general.set(p.product_id, p.prix_unitaire);
    } else {
      const key = `${p.product_id}:${p.client_id}`;
      if (!overrideMap.has(key)) {
        overrideMap.set(key, {
          product_id: p.product_id,
          client_id: p.client_id,
          prix_unitaire: p.prix_unitaire,
        });
      }
    }
  }

  const options: ProductOption[] = (products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    prix_unitaire: general.get(p.id) ?? null,
  }));

  return { clients: clients ?? [], products: options, overrides: [...overrideMap.values()] };
}
