"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { SelectionBar } from "@/components/ui/selection-bar";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty,
} from "@/components/ui/table";
import { useSelection } from "@/hooks/use-selection";
import { useTableControls, applyTableControls, HeaderMenu } from "@/components/ui/table-controls";
import { formatDZD, formatDate } from "@/lib/format";
import type { Proforma, Prospect, ProformaStatut } from "@/lib/supabase/types";
import { deleteProformas } from "./actions";

const STATUT: Record<ProformaStatut, { label: string; variant: "default" | "success" | "warning" | "neutral" }> = {
  brouillon: { label: "Brouillon", variant: "neutral" },
  envoye: { label: "Envoyé", variant: "default" },
  valide: { label: "Validé", variant: "success" },
  refuse: { label: "Refusé", variant: "warning" },
};

export function DevisList({ proformas, prospects }: { proformas: Proforma[]; prospects: Pick<Prospect, "id" | "name">[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [pending, start] = useTransition();
  const prospectName = useMemo(() => new Map(prospects.map((p) => [p.id, p.name])), [prospects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return proformas;
    return proformas.filter((d) => [d.numero, d.prospect_id ? prospectName.get(d.prospect_id) : ""].filter(Boolean).some((v) => v!.toLowerCase().includes(q)));
  }, [proformas, search, prospectName]);

  const controls = useTableControls();
  const accessors = useMemo(() => ({
    numero: (d: Proforma) => d.numero,
    date: (d: Proforma) => d.date,
    prospect: (d: Proforma) => (d.prospect_id ? prospectName.get(d.prospect_id) ?? "—" : "—"),
    statut: (d: Proforma) => STATUT[d.statut].label,
    total: (d: Proforma) => Number(d.total_ttc),
  }), [prospectName]);
  const rows = useMemo(() => applyTableControls(filtered, accessors, controls.sort, controls.filters), [filtered, accessors, controls.sort, controls.filters]);
  const statutValues = useMemo(() => filtered.map((d) => STATUT[d.statut].label), [filtered]);

  const sel = useSelection(rows.map((d) => d.id));
  function bulkDelete() {
    if (!confirm(`Supprimer ${sel.count} devis ?`)) return;
    start(async () => { const res = await deleteProformas(sel.selected); if (res.ok) sel.clear(); else alert(res.error); });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Devis / Proforma"
        description={`${proformas.length} devis`}
        actions={<Button onClick={() => router.push("/devis/nouveau")}><Plus className="size-4" /> Nouveau devis</Button>}
      />

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Rechercher (numéro, prospect…)" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-9"><Checkbox checked={sel.allChecked} indeterminate={sel.someChecked} onChange={sel.toggleAll} aria-label="Tout sélectionner" /></TableHead>
            <TableHead><HeaderMenu label="Numéro" colKey="numero" controls={controls} /></TableHead>
            <TableHead><HeaderMenu label="Date" colKey="date" controls={controls} numeric /></TableHead>
            <TableHead><HeaderMenu label="Prospect" colKey="prospect" controls={controls} /></TableHead>
            <TableHead><HeaderMenu label="Statut" colKey="statut" controls={controls} values={statutValues} /></TableHead>
            <TableHead className="text-right"><HeaderMenu label="Total TTC" colKey="total" controls={controls} numeric align="right" /></TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableEmpty colSpan={7}>{search ? "Aucun devis trouvé." : "Aucun devis. Cliquez sur « Nouveau devis »."}</TableEmpty>
          ) : rows.map((d) => (
            <TableRow key={d.id}>
              <TableCell><Checkbox checked={sel.isSelected(d.id)} onChange={() => sel.toggle(d.id)} aria-label="Sélectionner" /></TableCell>
              <TableCell><Link href={`/devis/${d.id}`} className="font-mono text-sm font-medium text-primary hover:underline">{d.numero}</Link></TableCell>
              <TableCell className="text-muted whitespace-nowrap">{formatDate(d.date)}</TableCell>
              <TableCell className="text-foreground">{d.prospect_id ? prospectName.get(d.prospect_id) ?? "—" : "—"}</TableCell>
              <TableCell><Badge variant={STATUT[d.statut].variant}>{STATUT[d.statut].label}</Badge></TableCell>
              <TableCell className="text-right font-medium text-foreground">{formatDZD(d.total_ttc)}</TableCell>
              <TableCell className="text-right">
                <Link href={`/devis/${d.id}`}><Button variant="ghost" size="icon" aria-label="Ouvrir"><FileText className="size-4" /></Button></Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <SelectionBar count={sel.count} noun="devis" onClear={sel.clear} onDelete={bulkDelete} pending={pending} />
    </div>
  );
}
