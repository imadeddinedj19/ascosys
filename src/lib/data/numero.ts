import { createClient } from "@/lib/supabase/server";
import type { SalesDocumentType } from "@/lib/supabase/types";

type SB = Awaited<ReturnType<typeof createClient>>;

async function numeroExists(supabase: SB, numero: string): Promise<boolean> {
  const { data } = await supabase.from("sales_documents").select("id").eq("numero", numero).maybeSingle();
  return !!data;
}

/**
 * Numéro suggéré pour un nouveau document (sans consommer le compteur) :
 *  - facture : (dernier + 1)/AA
 *  - bon     : (dernier + 1)/MM/AA
 * Saute les numéros déjà utilisés.
 */
export async function suggestNumero(type: SalesDocumentType): Promise<string> {
  const supabase = await createClient();
  const now = new Date();
  const year = now.getFullYear();
  const yy = String(year).slice(-2);

  if (type === "facture") {
    const { data } = await supabase.from("facture_counters").select("last").eq("year", year).maybeSingle();
    let n = (data?.last ?? 0) + 1;
    let cand = `${n}/${yy}`;
    while (await numeroExists(supabase, cand)) { n++; cand = `${n}/${yy}`; }
    return cand;
  }

  const month = now.getMonth() + 1;
  const mm = String(month).padStart(2, "0");
  const { data } = await supabase.from("bl_counters").select("last").eq("year", year).eq("month", month).maybeSingle();
  let n = (data?.last ?? 0) + 1;
  let cand = `${n}/${mm}/${yy}`;
  while (await numeroExists(supabase, cand)) { n++; cand = `${n}/${mm}/${yy}`; }
  return cand;
}
