import { redirect } from "next/navigation";

// L'ancienne page « Ventes & Factures » est désormais scindée en deux sections :
// Factures et Bons de livraison. On redirige vers les Factures par défaut.
export default function VentesPage() {
  redirect("/factures");
}
