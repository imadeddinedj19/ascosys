import { buildSalesPdf } from "@/lib/pdf/sales-pdf";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return buildSalesPdf(id, "facture");
}
