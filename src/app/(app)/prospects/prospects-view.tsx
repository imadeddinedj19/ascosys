"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Search, FileText, Phone, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Checkbox } from "@/components/ui/checkbox";
import { SelectionBar } from "@/components/ui/selection-bar";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty,
} from "@/components/ui/table";
import { useSelection } from "@/hooks/use-selection";
import { useTableControls, applyTableControls, HeaderMenu } from "@/components/ui/table-controls";
import type { Prospect } from "@/lib/supabase/types";
import { saveProspect, deleteProspects, type ProspectInput } from "./actions";

const STATUS = {
  nouveau: { label: "Nouveau", variant: "default" as const },
  en_discussion: { label: "En discussion", variant: "warning" as const },
  gagne: { label: "Gagné", variant: "success" as const },
  perdu: { label: "Perdu", variant: "neutral" as const },
};

const EMPTY: ProspectInput = { name: "", contact_person: "", phone: "", email: "", industry_type: "", notes: "", status: "nouveau" };

export function ProspectsView({ prospects, devisCounts }: { prospects: Prospect[]; devisCounts: Record<string, number> }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Prospect | null>(null);
  const [form, setForm] = useState<ProspectInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return prospects;
    return prospects.filter((p) => [p.name, p.contact_person, p.phone].filter(Boolean).some((v) => v!.toLowerCase().includes(q)));
  }, [prospects, search]);

  const controls = useTableControls();
  const accessors = useMemo(() => ({
    name: (p: Prospect) => p.name,
    status: (p: Prospect) => STATUS[p.status].label,
  }), []);
  const rows = useMemo(() => applyTableControls(filtered, accessors, controls.sort, controls.filters), [filtered, accessors, controls.sort, controls.filters]);
  const statusValues = useMemo(() => prospects.map((p) => STATUS[p.status].label), [prospects]);

  const sel = useSelection(rows.map((p) => p.id));

  function set<K extends keyof ProspectInput>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })); }
  function openNew() { setEditing(null); setForm(EMPTY); setError(null); setOpen(true); }
  function openEdit(p: Prospect) {
    setEditing(p);
    setForm({ name: p.name, contact_person: p.contact_person ?? "", phone: p.phone ?? "", email: p.email ?? "", industry_type: p.industry_type ?? "", notes: p.notes ?? "", status: p.status });
    setError(null); setOpen(true);
  }
  function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    start(async () => { const res = await saveProspect(editing?.id ?? null, form); if (res.ok) setOpen(false); else setError(res.error); });
  }
  function bulkDelete() {
    if (!confirm(`Supprimer ${sel.count} prospect(s) ?`)) return;
    start(async () => { const res = await deleteProspects(sel.selected); if (res.ok) sel.clear(); else alert(res.error); });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prospects"
        description={`${prospects.length} piste(s) commerciale(s)`}
        actions={<Button onClick={openNew}><Plus className="size-4" /> Nouveau prospect</Button>}
      />

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Rechercher (nom, téléphone…)" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-9"><Checkbox checked={sel.allChecked} indeterminate={sel.someChecked} onChange={sel.toggleAll} aria-label="Tout sélectionner" /></TableHead>
            <TableHead><HeaderMenu label="Nom" colKey="name" controls={controls} /></TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Téléphone</TableHead>
            <TableHead><HeaderMenu label="Statut" colKey="status" controls={controls} values={statusValues} /></TableHead>
            <TableHead className="text-center">Devis</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableEmpty colSpan={7}>{search ? "Aucun prospect trouvé." : "Aucun prospect. Cliquez sur « Nouveau prospect »."}</TableEmpty>
          ) : rows.map((p) => (
            <TableRow key={p.id}>
              <TableCell><Checkbox checked={sel.isSelected(p.id)} onChange={() => sel.toggle(p.id)} aria-label="Sélectionner" /></TableCell>
              <TableCell className="font-medium text-foreground">
                {p.name}
                {p.client_id && <Badge variant="success" className="ml-2"><CheckCircle2 className="size-3" /> Client</Badge>}
              </TableCell>
              <TableCell className="text-muted">{p.contact_person ?? "—"}</TableCell>
              <TableCell className="text-muted">{p.phone ? <span className="inline-flex items-center gap-1.5"><Phone className="size-3.5 text-muted-foreground" />{p.phone}</span> : "—"}</TableCell>
              <TableCell><Badge variant={STATUS[p.status].variant}>{STATUS[p.status].label}</Badge></TableCell>
              <TableCell className="text-center text-muted">{devisCounts[p.id] ?? 0}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button variant="outline" size="sm" onClick={() => router.push(`/devis/nouveau?prospect=${p.id}`)}><FileText className="size-3.5" /> Devis</Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)} aria-label="Modifier"><Pencil className="size-4" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Modifier le prospect" : "Nouveau prospect"} className="max-w-xl">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label htmlFor="name">Nom / raison sociale *</Label><Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} required autoFocus /></div>
            <div><Label htmlFor="contact_person">Personne de contact</Label><Input id="contact_person" value={form.contact_person ?? ""} onChange={(e) => set("contact_person", e.target.value)} /></div>
            <div><Label htmlFor="phone">Téléphone</Label><Input id="phone" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></div>
            <div><Label htmlFor="email">E-mail</Label><Input id="email" type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} /></div>
            <div>
              <Label htmlFor="status">Statut</Label>
              <Select id="status" value={form.status} onChange={(e) => set("status", e.target.value)}>
                <option value="nouveau">Nouveau</option>
                <option value="en_discussion">En discussion</option>
                <option value="gagne">Gagné</option>
                <option value="perdu">Perdu</option>
              </Select>
            </div>
            <div className="sm:col-span-2"><Label htmlFor="industry_type">Secteur d&apos;activité</Label><Input id="industry_type" value={form.industry_type ?? ""} onChange={(e) => set("industry_type", e.target.value)} /></div>
            <div className="sm:col-span-2"><Label htmlFor="notes">Notes</Label><Textarea id="notes" rows={2} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>
          </div>
        </form>
      </Modal>

      <SelectionBar count={sel.count} noun="prospect" onClear={sel.clear} onDelete={bulkDelete} pending={pending} />
    </div>
  );
}
