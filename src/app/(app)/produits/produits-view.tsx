"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Search, FileText, Upload } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Checkbox } from "@/components/ui/checkbox";
import { SelectionBar } from "@/components/ui/selection-bar";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty,
} from "@/components/ui/table";
import { useSelection } from "@/hooks/use-selection";
import { useTableControls, applyTableControls, HeaderMenu } from "@/components/ui/table-controls";
import { createClient } from "@/lib/supabase/client";
import type { Product, Client, Forme } from "@/lib/supabase/types";
import { saveProduct, deleteProduct, deleteProducts, type ProductInput } from "./actions";

const EMPTY: ProductInput = { name: "", ref: "", client_id: "", forme_id: "", trace: "", active: true };

function toForm(p: Product): ProductInput {
  return {
    name: p.name, ref: p.ref ?? "", client_id: p.client_id ?? "", forme_id: p.forme_id ?? "",
    trace: p.trace ?? "", active: p.active,
  };
}

const traceName = (path: string) => path.replace(/^[0-9a-f-]{36}-/i, "");

export function ProduitsView({
  products, clients, formes,
}: { products: Product[]; clients: Client[]; formes: Forme[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();

  const clientName = useMemo(() => new Map(clients.map((c) => [c.id, c.company_name])), [clients]);
  const formeRef = useMemo(() => new Map(formes.map((f) => [f.id, f.ref])), [formes]);
  const clientOptions = useMemo(() => clients.map((c) => ({ value: c.id, label: c.company_name })), [clients]);
  const formeOptions = useMemo(() => formes.map((f) => ({ value: f.id, label: f.ref })), [formes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => [p.name, p.ref].filter(Boolean).some((v) => v!.toLowerCase().includes(q)));
  }, [products, search]);

  const controls = useTableControls();
  const accessors = useMemo(() => ({
    name: (p: Product) => p.name,
    client: (p: Product) => (p.client_id ? clientName.get(p.client_id) ?? "—" : "—"),
    etat: (p: Product) => (p.active ? "Actif" : "Inactif"),
  }), [clientName]);
  const rows = useMemo(
    () => applyTableControls(filtered, accessors, controls.sort, controls.filters),
    [filtered, accessors, controls.sort, controls.filters],
  );
  const clientValues = useMemo(() => products.map((p) => (p.client_id ? clientName.get(p.client_id) ?? "—" : "—")), [products, clientName]);

  const sel = useSelection(rows.map((p) => p.id));
  function bulkDelete() {
    if (!confirm(`Supprimer ${sel.count} produit(s) ? Cette action est irréversible.`)) return;
    start(async () => { const res = await deleteProducts(sel.selected); if (res.ok) sel.clear(); else alert(res.error); });
  }

  function openNew() { setEditing(null); setForm(EMPTY); setError(null); setOpen(true); }
  function openEdit(p: Product) { setEditing(p); setForm(toForm(p)); setError(null); setOpen(true); }
  function set<K extends keyof ProductInput>(k: K, v: string | boolean) { setForm((f) => ({ ...f, [k]: v })); }

  const traceUrl = (path: string) => supabase.storage.from("traces").getPublicUrl(path).data.publicUrl;

  async function onTraceFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const path = `${crypto.randomUUID()}-${file.name.replace(/\s+/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("traces").upload(path, file, {
      contentType: file.type || "application/pdf",
    });
    setUploading(false);
    if (upErr) { setError(`Échec de l'envoi du tracé : ${upErr.message}`); return; }
    set("trace", path);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    start(async () => {
      const res = await saveProduct(editing?.id ?? null, form);
      if (res.ok) setOpen(false); else setError(res.error);
    });
  }
  function remove(p: Product) {
    if (!confirm(`Supprimer le produit « ${p.name} » ?`)) return;
    start(async () => { const res = await deleteProduct(p.id); if (!res.ok) alert(res.error); });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produits"
        description={`${products.length} produit(s) au catalogue`}
        actions={<Button onClick={openNew}><Plus className="size-4" /> Nouveau produit</Button>}
      />

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Rechercher (désignation, réf…)" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-9"><Checkbox checked={sel.allChecked} indeterminate={sel.someChecked} onChange={sel.toggleAll} aria-label="Tout sélectionner" /></TableHead>
            <TableHead><HeaderMenu label="Désignation" colKey="name" controls={controls} /></TableHead>
            <TableHead>Réf</TableHead>
            <TableHead><HeaderMenu label="Client" colKey="client" controls={controls} values={clientValues} /></TableHead>
            <TableHead>Découpe</TableHead>
            <TableHead>Tracé</TableHead>
            <TableHead><HeaderMenu label="État" colKey="etat" controls={controls} values={["Actif", "Inactif"]} /></TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableEmpty colSpan={8}>{search ? "Aucun produit trouvé." : "Aucun produit. Cliquez sur « Nouveau produit »."}</TableEmpty>
          ) : rows.map((p) => (
            <TableRow key={p.id}>
              <TableCell><Checkbox checked={sel.isSelected(p.id)} onChange={() => sel.toggle(p.id)} aria-label="Sélectionner" /></TableCell>
              <TableCell className="font-medium text-foreground">{p.name}</TableCell>
              <TableCell className="font-mono text-xs text-muted">{p.ref ?? "—"}</TableCell>
              <TableCell className="text-muted">{p.client_id ? clientName.get(p.client_id) ?? "—" : "—"}</TableCell>
              <TableCell className="font-mono text-xs text-muted">{p.forme_id ? formeRef.get(p.forme_id) ?? "—" : "—"}</TableCell>
              <TableCell>
                {p.trace ? (
                  <a href={traceUrl(p.trace)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    <FileText className="size-3.5" /> PDF
                  </a>
                ) : <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell>{p.active ? <Badge variant="success">Actif</Badge> : <Badge variant="neutral">Inactif</Badge>}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)} aria-label="Modifier"><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(p)} aria-label="Supprimer" className="text-danger hover:text-danger"><Trash2 className="size-4" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Modifier le produit" : "Nouveau produit"} className="max-w-xl">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label htmlFor="name">Désignation *</Label><Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} required autoFocus /></div>
            <div><Label htmlFor="ref">Référence (optionnel)</Label><Input id="ref" value={form.ref ?? ""} onChange={(e) => set("ref", e.target.value)} /></div>
            <div>
              <Label htmlFor="client_id">Client (optionnel)</Label>
              <Combobox id="client_id" value={form.client_id ?? ""} onChange={(v) => set("client_id", v)} options={clientOptions} placeholder="— Aucun —" searchPlaceholder="Rechercher un client…" allowClear />
            </div>
            <div>
              <Label htmlFor="forme_id">Découpe (optionnel)</Label>
              <Combobox id="forme_id" value={form.forme_id ?? ""} onChange={(v) => set("forme_id", v)} options={formeOptions} placeholder="— Aucune —" searchPlaceholder="Rechercher une découpe…" allowClear />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input id="active" type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} className="size-4 accent-[var(--primary)]" />
              <Label htmlFor="active" className="mb-0">Produit actif</Label>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="trace">Tracé (PDF de la découpe)</Label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-sm text-foreground hover:border-primary/40">
                  <Upload className="size-4" /> {uploading ? "Envoi…" : "Choisir un PDF"}
                  <input type="file" accept="application/pdf" onChange={onTraceFile} className="hidden" disabled={uploading} />
                </label>
                {form.trace && (
                  <>
                    <a href={traceUrl(form.trace)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <FileText className="size-3.5" /> {traceName(form.trace)}
                    </a>
                    <button type="button" onClick={() => set("trace", "")} className="text-xs text-danger hover:underline">Retirer</button>
                  </>
                )}
              </div>
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={pending || uploading}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>
          </div>
        </form>
      </Modal>

      <SelectionBar count={sel.count} noun="produit" onClear={sel.clear} onDelete={bulkDelete} pending={pending} />
    </div>
  );
}
