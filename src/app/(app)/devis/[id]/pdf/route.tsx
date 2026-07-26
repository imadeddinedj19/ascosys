import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { ProformaPDF, type ProformaPdfData } from "@/components/pdf/proforma-pdf";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) return new Response("Base de données non connectée.", { status: 400 });
  const { id } = await params;
  const supabase = await createClient();

  const { data: prof } = await supabase.from("proformas").select("*").eq("id", id).single();
  if (!prof) return new Response("Devis introuvable.", { status: 404 });

  const [{ data: lines }, { data: prospect }] = await Promise.all([
    supabase.from("proforma_lines").select("*").eq("proforma_id", id).order("position"),
    prof.prospect_id ? supabase.from("prospects").select("name, phone").eq("id", prof.prospect_id).single() : Promise.resolve({ data: null }),
  ]);

  const data: ProformaPdfData = {
    numero: prof.numero,
    date: prof.date,
    clientName: prospect?.name ?? "—",
    clientPhone: prospect?.phone ?? null,
    notes: prof.notes,
    tva_rate: prof.tva_rate,
    total_ht: prof.total_ht,
    total_tva: prof.total_tva,
    total_ttc: prof.total_ttc,
    lines: (lines ?? []).map((l) => ({ designation: l.designation, quantite: l.quantite, prix_unitaire: l.prix_unitaire, total_ht: l.total_ht })),
  };

  const buffer = await renderToBuffer(<ProformaPDF data={data} />);
  return new Response(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="Proforma-${prof.numero.replace("/", "-")}.pdf"` },
  });
}
