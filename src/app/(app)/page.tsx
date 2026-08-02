import Link from "next/link";
import {
  Users, Package, Receipt, Wallet, ArrowRight, Scissors, Coins, UsersRound,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { RevenueChart, type RevenuePoint } from "@/components/dashboard/revenue-chart";
import { formatDZD } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata = { title: "Tableau de bord · AscoSys" };

const shortcuts = [
  { href: "/clients", label: "Gérer les clients", icon: Users },
  { href: "/produits", label: "Catalogue produits", icon: Package },
  { href: "/formes", label: "Formes de découpe", icon: Scissors },
  { href: "/ventes/nouveau", label: "Nouvelle vente / facture", icon: Receipt },
  { href: "/tresorerie", label: "Trésorerie", icon: Coins },
  { href: "/salaires", label: "Salaires", icon: UsersRound },
];

type Stats = {
  caMois: number;
  encaissementsMois: number;
  soldeClients: number;
  soldeCaisse: number;
  revenue: RevenuePoint[];
};

function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }

async function getStats(): Promise<Stats> {
  const supabase = await createClient();
  const [{ data: docs }, { data: pays }, { data: balances }, { data: treso }] = await Promise.all([
    supabase.from("sales_documents").select("date, total_ttc, statut").eq("fictive", false),
    supabase.from("payments").select("date, montant"),
    supabase.from("client_balance").select("solde"),
    supabase.from("transactions_running").select("solde, date, created_at").order("date", { ascending: false }).order("created_at", { ascending: false }).limit(1),
  ]);

  const now = new Date();
  const curKey = monthKey(now);

  const caMois = (docs ?? [])
    .filter((d) => d.statut !== "brouillon" && d.date?.slice(0, 7) === curKey)
    .reduce((s, d) => s + Number(d.total_ttc), 0);

  const encaissementsMois = (pays ?? [])
    .filter((p) => p.date?.slice(0, 7) === curKey)
    .reduce((s, p) => s + Number(p.montant), 0);

  const soldeClients = (balances ?? []).reduce((s, b) => s + Number(b.solde), 0);
  const soldeCaisse = treso && treso.length ? Number(treso[0].solde) : 0;

  // 6 derniers mois
  const months: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: monthKey(d), label: new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(d) });
  }
  const revenue: RevenuePoint[] = months.map((m) => ({
    label: m.label,
    total: (docs ?? [])
      .filter((d) => d.statut !== "brouillon" && d.date?.slice(0, 7) === m.key)
      .reduce((s, d) => s + Number(d.total_ttc), 0),
  }));

  return { caMois, encaissementsMois, soldeClients, soldeCaisse, revenue };
}

export default async function DashboardPage() {
  const demo = !isSupabaseConfigured();
  const stats: Stats = demo
    ? { caMois: 0, encaissementsMois: 0, soldeClients: 0, soldeCaisse: 0, revenue: [] }
    : await getStats();

  return (
    <div className="space-y-7">
      <PageHeader title="Tableau de bord" description="Vue d'ensemble de l'activité — ASCO Trading Group" />

      {demo && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="pt-5 text-sm text-warning/90">
            <p className="font-medium text-warning">Mode démonstration</p>
            <p className="mt-1">
              Connectez votre projet Supabase (voir <code className="font-mono">.env.local</code>) puis exécutez{" "}
              <code className="font-mono">supabase/migrations/0001_init.sql</code> pour activer les chiffres réels.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Chiffre d'affaires (mois)" value={formatDZD(stats.caMois)} icon={Receipt} />
        <StatCard label="Encaissements (mois)" value={formatDZD(stats.encaissementsMois)} icon={Wallet} accent="success" />
        <StatCard label="Solde clients" value={formatDZD(stats.soldeClients)} icon={Users} accent="warning" />
        <StatCard label="Solde trésorerie" value={formatDZD(stats.soldeCaisse)} icon={Coins} />
      </div>

      <Card>
        <CardHeader><CardTitle>Chiffre d&apos;affaires — 6 derniers mois</CardTitle></CardHeader>
        <CardContent>
          <RevenueChart data={stats.revenue} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Accès rapides</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shortcuts.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="group flex items-center justify-between rounded-lg border border-border bg-surface-2/40 px-4 py-3 text-sm transition-colors hover:border-primary/40 hover:bg-surface-2">
                <span className="flex items-center gap-3"><Icon className="size-4 text-primary" />{label}</span>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
