import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { VersementPDF, type VersementPdfData } from "@/components/pdf/versement-pdf";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!isSupabaseConfigured()) return new Response("Base de données non connectée.", { status: 400 });
  const url = new URL(req.url);
  const depositId = url.searchParams.get("deposit");
  const paymentId = url.searchParams.get("payment");
  const supabase = await createClient();

  let data: VersementPdfData | null = null;

  if (depositId) {
    const { data: dep } = await supabase.from("prospect_deposits").select("*").eq("id", depositId).single();
    if (!dep) return new Response("Versement introuvable.", { status: 404 });
    const { data: prospect } = await supabase.from("prospects").select("name").eq("id", dep.prospect_id).single();
    // Balance = total du devis − total des acomptes du prospect.
    let balance = 0;
    if (dep.proforma_id) {
      const { data: prof } = await supabase.from("proformas").select("total_ttc").eq("id", dep.proforma_id).single();
      const { data: deps } = await supabase.from("prospect_deposits").select("montant").eq("prospect_id", dep.prospect_id);
      const paid = (deps ?? []).reduce((sum, d) => sum + Number(d.montant), 0);
      balance = Math.round(((prof?.total_ttc ?? 0) - paid) * 100) / 100;
    }
    data = { name: prospect?.name ?? "—", date: dep.date, versement: Number(dep.montant), balance, reference: dep.note };
  } else if (paymentId) {
    const { data: pay } = await supabase.from("payments").select("*").eq("id", paymentId).single();
    if (!pay) return new Response("Paiement introuvable.", { status: 404 });
    const [{ data: client }, { data: bal }] = await Promise.all([
      supabase.from("clients").select("company_name").eq("id", pay.client_id).single(),
      supabase.from("client_balance").select("solde").eq("client_id", pay.client_id).single(),
    ]);
    data = { name: client?.company_name ?? "—", date: pay.date, versement: Number(pay.montant), balance: Number(bal?.solde ?? 0), reference: pay.reference };
  }

  if (!data) return new Response("Paramètre manquant (deposit ou payment).", { status: 400 });

  const buffer = await renderToBuffer(<VersementPDF data={data} />);
  const safe = data.name.replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 40);
  return new Response(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="Bon-versement-${safe}.pdf"` },
  });
}
