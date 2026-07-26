import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { SupabaseNotice } from "@/components/layout/supabase-notice";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getClientsAndProducts } from "@/lib/data/catalog";
import { DevisEditor, type DevisInitial } from "@/components/devis/devis-editor";
import type { Prospect, Proforma, ProformaLine, ProspectDeposit } from "@/lib/supabase/types";

export const metadata = { title: "Devis · AscoSys" };

export default async function DevisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-7">
        <PageHeader title="Devis" />
        <SupabaseNotice />
      </div>
    );
  }

  const supabase = await createClient();
  const { data: prof } = await supabase.from("proformas").select("*").eq("id", id).single<Proforma>();
  if (!prof) notFound();

  const [{ data: lines }, { data: deposits }, { data: prospects }, { products }] = await Promise.all([
    supabase.from("proforma_lines").select("*").eq("proforma_id", id).order("position").returns<ProformaLine[]>(),
    prof.prospect_id
      ? supabase.from("prospect_deposits").select("*").eq("prospect_id", prof.prospect_id).order("date").returns<ProspectDeposit[]>()
      : Promise.resolve({ data: [] as ProspectDeposit[] }),
    supabase.from("prospects").select("*").order("name"),
    getClientsAndProducts(),
  ]);

  const initial: DevisInitial = {
    id: prof.id,
    numero: prof.numero,
    prospect_id: prof.prospect_id,
    date: prof.date,
    tva_rate: prof.tva_rate,
    statut: prof.statut,
    notes: prof.notes,
    lines: (lines ?? []).map((l) => ({ product_id: l.product_id ?? "", designation: l.designation, quantite: String(l.quantite), prix_unitaire: String(l.prix_unitaire) })),
    deposits: deposits ?? [],
  };

  return <DevisEditor prospects={(prospects ?? []) as Prospect[]} products={products} initial={initial} />;
}
