import { renderToBuffer } from "@react-pdf/renderer";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { buildClientStatement } from "@/lib/data/statement";
import { StatementPDF } from "@/components/pdf/statement-pdf";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!isSupabaseConfigured()) return new Response("Base de données non connectée.", { status: 400 });

  const url = new URL(req.url);
  const clientId = url.searchParams.get("client");
  const year = Number(url.searchParams.get("year") ?? new Date().getFullYear());
  if (!clientId) return new Response("Client manquant.", { status: 400 });

  const statement = await buildClientStatement(clientId, year);
  if (!statement) return new Response("Client introuvable.", { status: 404 });

  const buffer = await renderToBuffer(<StatementPDF statement={statement} />);
  const safeName = statement.client.company_name.replace(/[^a-zA-Z0-9-_]+/g, "-").slice(0, 40);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Releve-${safeName}-${year}.pdf"`,
    },
  });
}
