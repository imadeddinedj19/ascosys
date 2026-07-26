"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty,
} from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import type { Forme } from "@/lib/supabase/types";
import { saveForme, deleteForme, type FormeInput } from "./actions";

const EMPTY: FormeInput = {
  ref: "", fournisseur: "BELHADJ", longueur: "", largeur: "", hauteur: "",
  hauteur_couvercle: "", longueur_forme: "", largeur_forme: "", nb_poses: "",
  laize_utilisee: "", poids_par_feuille: "", storage_location: "", notes: "",
};

function toForm(f: Forme): FormeInput {
  const s = (v: number | null) => (v === null ? "" : String(v));
  return {
    ref: f.ref, fournisseur: f.fournisseur ?? "", longueur: s(f.longueur),
    largeur: s(f.largeur), hauteur: s(f.hauteur), hauteur_couvercle: s(f.hauteur_couvercle),
    longueur_forme: s(f.longueur_forme), largeur_forme: s(f.largeur_forme),
    nb_poses: s(f.nb_poses), laize_utilisee: f.laize_utilisee ?? "", poids_par_feuille: s(f.poids_par_feuille),
    storage_location: f.storage_location ?? "", notes: f.notes ?? "",
  };
}

export function FormesView({ initialFormes }: { initialFormes: Forme[] }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Forme | null>(null);
  const [form, setForm] = useState<FormeInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return initialFormes;
    return initialFormes.filter((f) =>
      [f.ref, f.fournisseur, f.storage_location].filter(Boolean).some((v) => v!.toLowerCase().includes(q)),
    );
  }, [initialFormes, search]);

  function openNew() { setEditing(null); setForm(EMPTY); setError(null); setOpen(true); }
  function openEdit(f: Forme) { setEditing(f); setForm(toForm(f)); setError(null); setOpen(true); }
  function set<K extends keyof FormeInput>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    start(async () => {
      const res = await saveForme(editing?.id ?? null, form);
      if (res.ok) setOpen(false); else setError(res.error);
    });
  }
  function remove(f: Forme) {
    if (!confirm(`Supprimer la forme « ${f.ref} » ?`)) return;
    start(async () => { const res = await deleteForme(f.id); if (!res.ok) alert(res.error); });
  }

  const dims = (f: Forme) =>
    [f.longueur, f.largeur, f.hauteur].filter((v) => v !== null).map((v) => formatNumber(v!, 1)).join(" × ") || "—";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Formes de découpe"
        description={`${initialFormes.length} forme(s) — catalogue « Lmoule »`}
        actions={<Button onClick={openNew}><Plus className="size-4" /> Nouvelle forme</Button>}
      />

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Rechercher (réf, emplacement…)" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Référence</TableHead>
            <TableHead>Dimensions (L×l×H)</TableHead>
            <TableHead>Forme (L×l)</TableHead>
            <TableHead>Poses</TableHead>
            <TableHead>Emplacement</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableEmpty colSpan={6}>{search ? "Aucune forme trouvée." : "Aucune forme. Cliquez sur « Nouvelle forme »."}</TableEmpty>
          ) : filtered.map((f) => (
            <TableRow key={f.id}>
              <TableCell className="font-mono text-xs font-medium text-foreground">{f.ref}</TableCell>
              <TableCell className="text-muted">{dims(f)}</TableCell>
              <TableCell className="text-muted">
                {f.longueur_forme !== null || f.largeur_forme !== null
                  ? `${formatNumber(f.longueur_forme ?? 0, 0)} × ${formatNumber(f.largeur_forme ?? 0, 0)}`
                  : "—"}
              </TableCell>
              <TableCell className="text-muted">{f.nb_poses !== null ? formatNumber(f.nb_poses, 0) : "—"}</TableCell>
              <TableCell className="text-muted">{f.storage_location ?? "—"}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(f)} aria-label="Modifier"><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(f)} aria-label="Supprimer" className="text-danger hover:text-danger"><Trash2 className="size-4" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Modifier la forme" : "Nouvelle forme"} className="max-w-2xl">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Label htmlFor="ref">Référence *</Label>
              <Input id="ref" value={form.ref} onChange={(e) => set("ref", e.target.value)} required autoFocus />
            </div>
            <div>
              <Label htmlFor="fournisseur">Fournisseur</Label>
              <Input id="fournisseur" value={form.fournisseur ?? ""} onChange={(e) => set("fournisseur", e.target.value)} />
            </div>
            <div><Label htmlFor="longueur">Longueur</Label><Input id="longueur" inputMode="decimal" value={form.longueur} onChange={(e) => set("longueur", e.target.value)} /></div>
            <div><Label htmlFor="largeur">Largeur</Label><Input id="largeur" inputMode="decimal" value={form.largeur} onChange={(e) => set("largeur", e.target.value)} /></div>
            <div><Label htmlFor="hauteur">Hauteur</Label><Input id="hauteur" inputMode="decimal" value={form.hauteur} onChange={(e) => set("hauteur", e.target.value)} /></div>
            <div><Label htmlFor="hauteur_couvercle">Hauteur couvercle</Label><Input id="hauteur_couvercle" inputMode="decimal" value={form.hauteur_couvercle} onChange={(e) => set("hauteur_couvercle", e.target.value)} /></div>
            <div><Label htmlFor="longueur_forme">Longueur forme</Label><Input id="longueur_forme" inputMode="decimal" value={form.longueur_forme} onChange={(e) => set("longueur_forme", e.target.value)} /></div>
            <div><Label htmlFor="largeur_forme">Largeur forme</Label><Input id="largeur_forme" inputMode="decimal" value={form.largeur_forme} onChange={(e) => set("largeur_forme", e.target.value)} /></div>
            <div><Label htmlFor="nb_poses">Nombre de poses</Label><Input id="nb_poses" inputMode="decimal" value={form.nb_poses} onChange={(e) => set("nb_poses", e.target.value)} /></div>
            <div><Label htmlFor="laize_utilisee">Laize utilisée</Label><Input id="laize_utilisee" value={form.laize_utilisee ?? ""} onChange={(e) => set("laize_utilisee", e.target.value)} /></div>
            <div><Label htmlFor="poids_par_feuille">Poids par feuille</Label><Input id="poids_par_feuille" inputMode="decimal" value={form.poids_par_feuille} onChange={(e) => set("poids_par_feuille", e.target.value)} /></div>
            <div className="sm:col-span-3"><Label htmlFor="storage_location">Emplacement de stockage</Label><Input id="storage_location" value={form.storage_location ?? ""} onChange={(e) => set("storage_location", e.target.value)} /></div>
            <div className="sm:col-span-3"><Label htmlFor="notes">Notes</Label><Textarea id="notes" rows={2} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
