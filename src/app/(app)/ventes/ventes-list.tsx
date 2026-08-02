"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Trash2, FileText } from "lucide-react";
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
import type { SalesDocument, Client } from "@/lib/supabase/types";
import { deleteDocument, deleteDocuments } from "./actions";

const STATUT_BADGE = {
  brouillon: { label: "Brouillon", variant: "neutral" as const },
  valide: { label: "Validé", variant: "default" as const },
  paye: { label: "Payé", variant: "success" as const },
};

export function DocumentsList({
  mode, documents, clients,
}: { mode: "facture" | "bon"; documents: SalesDocument[]; clients: Client[] }) {
  const router = useRouter();
  const isFacture = mode === "facture";
  const [search, setSearch] = useState("");
  const [pending, start] = useTransition();
  const clientName = useMemo(() => new Map(clients.map((c) => [c.id, c.company_name])), [clients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((d) => {
      if (!q) return true;
      return [d.numero, clientName.get(d.client_id)].filter(Boolean).some((v) => v!.toLowerCase().includes(q));
    });
  }, [documents, search, clientName]);

  const controls = useTableControls();
  const STATUT = { brouillon: "Brouillon", valide: "Validé", paye: "Payé" } as const;
  const accessors = useMemo(() => ({
    numero: (d: SalesDocument) => d.numero,
    date: (d: SalesDocument) => d.date,
    client: (d: SalesDocument) => clientName.get(d.client_id) ?? "—",
    statut: (d: SalesDocument) => STATUT[d.statut],
    total: (d: SalesDocument) => Number(d.total_ttc),
  }), [clientName]);
  const rows = useMemo(
    () => applyTableControls(filtered, accessors, controls.sort, controls.filters),
    [filtered, accessors, controls.sort, controls.filters],
  );
  const clientValues = useMemo(() => filtered.map((d) => clientName.get(d.client_id) ?? "—"), [filtered, clientName]);
  const statutValues = useMemo(() => filtered.map((d) => STATUT[d.statut]), [filtered]);

  const sel = useSelection(rows.map((d) => d.id));

  function remove(d: SalesDocument) {
    if (!confirm(`Supprimer le document ${d.numero} ?`)) return;
    start(async () => { const res = await deleteDocument(d.id); if (!res.ok) alert(res.error); });
  }
  function bulkDelete() {
    if (!confirm(`Supprimer ${sel.count} document(s) ? Cette action est irréversible.`)) return;
    start(async () => { const res = await deleteDocuments(sel.selected); if (res.ok) sel.clear(); else alert(res.error); });
  }

  const nouveauHref = `/ventes/nouveau?type=${mode}`;
  const visibleCount = rows.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={isFacture ? "Factures" : "Bons de livraison"}
        description={isFacture ? "Factures (TVA + droit de timbre) — numérotées N/AA" : "Bons de livraison (sans TVA) — numérotés N/MM/AA"}
        actions={<Button onClick={() => router.push(nouveauHref)}><Plus className="size-4" /> {isFacture ? "Nouvelle facture" : "Nouveau bon"}</Button>}
      />

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Rechercher (numéro, client…)" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-9"><Checkbox checked={sel.allChecked} indeterminate={sel.someChecked} onChange={sel.toggleAll} aria-label="Tout sélectionner" /></TableHead>
            <TableHead><HeaderMenu label="Numéro" colKey="numero" controls={controls} /></TableHead>
            <TableHead><HeaderMenu label="Date" colKey="date" controls={controls} numeric /></TableHead>
            <TableHead><HeaderMenu label="Client" colKey="client" controls={controls} values={clientValues} /></TableHead>
            <TableHead><HeaderMenu label="Statut" colKey="statut" controls={controls} values={statutValues} /></TableHead>
            <TableHead className="text-right"><HeaderMenu label={isFacture ? "Net à payer" : "Total"} colKey="total" controls={controls} numeric align="right" /></TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleCount === 0 ? (
            <TableEmpty colSpan={7}>{search ? "Aucun document trouvé." : `Aucun ${isFacture ? "facture" : "bon"}. Cliquez sur « ${isFacture ? "Nouvelle facture" : "Nouveau bon"} ».`}</TableEmpty>
          ) : rows.map((d) => {
            const st = STATUT_BADGE[d.statut];
            return (
              <TableRow key={d.id}>
                <TableCell><Checkbox checked={sel.isSelected(d.id)} onChange={() => sel.toggle(d.id)} aria-label="Sélectionner" /></TableCell>
                <TableCell>
                  <Link href={`/ventes/${d.id}`} className="font-mono text-sm font-medium text-primary hover:underline">{d.numero}</Link>
                  {d.historique && <Badge variant="neutral" className="ml-2">historique</Badge>}
                </TableCell>
                <TableCell className="text-muted whitespace-nowrap">{formatDate(d.date)}</TableCell>
                <TableCell className="text-foreground">{clientName.get(d.client_id) ?? "—"}</TableCell>
                <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                <TableCell className="text-right font-medium text-foreground">{formatDZD(d.total_ttc)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Link href={`/ventes/${d.id}`}>
                      <Button variant="ghost" size="icon" aria-label="Ouvrir"><FileText className="size-4" /></Button>
                    </Link>
                    <Button variant="ghost" size="icon" onClick={() => remove(d)} disabled={pending} aria-label="Supprimer" className="text-danger hover:text-danger"><Trash2 className="size-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <SelectionBar count={sel.count} noun="document" onClear={sel.clear} onDelete={bulkDelete} pending={pending} />
    </div>
  );
}
