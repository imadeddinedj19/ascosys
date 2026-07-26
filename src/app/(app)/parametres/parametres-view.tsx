"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Tags, Hash } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty,
} from "@/components/ui/table";
import type { TransactionCategory } from "@/lib/supabase/types";
import { saveCategory, deleteCategory, setFactureCounter, setBlCounter, type CategoryInput } from "./actions";

const DIR_LABEL = { in: "Entrée", out: "Sortie", both: "Les deux" } as const;

const emptyForm = (): CategoryInput => ({ name: "", direction: "out", color: "#22d3ee", active: true });

export function ParametresView({
  categories, factureLast, blLast, year, month,
}: {
  categories: TransactionCategory[];
  factureLast: number;
  blLast: number;
  year: number;
  month: number;
}) {
  const yy = String(year).slice(-2);
  const mm = String(month).padStart(2, "0");
  const [factureVal, setFactureVal] = useState(String(factureLast));
  const [blVal, setBlVal] = useState(String(blLast));
  const [numPending, startNum] = useTransition();

  function saveFacture() {
    startNum(async () => { const r = await setFactureCounter(factureVal); if (!r.ok) alert(r.error); });
  }
  function saveBl() {
    startNum(async () => { const r = await setBlCounter(blVal); if (!r.ok) alert(r.error); });
  }
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionCategory | null>(null);
  const [form, setForm] = useState<CategoryInput>(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function set<K extends keyof CategoryInput>(k: K, v: CategoryInput[K]) { setForm((f) => ({ ...f, [k]: v })); }

  function openNew() { setEditing(null); setForm(emptyForm()); setError(null); setOpen(true); }
  function openEdit(c: TransactionCategory) {
    setEditing(c);
    setForm({ name: c.name, direction: c.direction, color: c.color, active: c.active });
    setError(null); setOpen(true);
  }
  function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    start(async () => {
      const res = await saveCategory(editing?.id ?? null, form);
      if (res.ok) setOpen(false); else setError(res.error);
    });
  }
  function remove(c: TransactionCategory) {
    if (!confirm(`Supprimer la catégorie « ${c.name} » ? Les transactions existantes seront simplement « sans catégorie ».`)) return;
    start(async () => { const res = await deleteCategory(c.id); if (!res.ok) alert(res.error); });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Paramètres" description="Listes et libellés personnalisables du CRM" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Hash className="size-4 text-primary" /> Numérotation des documents</CardTitle>
          <CardDescription>Indiquez le dernier numéro utilisé pour que le prochain document continue votre séquence réelle.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="facture_last">Dernier n° de facture (année {yy})</Label>
            <div className="flex items-center gap-2">
              <Input id="facture_last" inputMode="numeric" className="w-28" value={factureVal} onChange={(e) => setFactureVal(e.target.value)} />
              <Button variant="secondary" size="sm" onClick={saveFacture} disabled={numPending}>Enregistrer</Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Prochaine facture : <span className="font-mono text-primary">{(Number(factureVal) || 0) + 1}/{yy}</span></p>
          </div>
          <div>
            <Label htmlFor="bl_last">Dernier n° de bon de livraison (mois {mm}/{yy})</Label>
            <div className="flex items-center gap-2">
              <Input id="bl_last" inputMode="numeric" className="w-28" value={blVal} onChange={(e) => setBlVal(e.target.value)} />
              <Button variant="secondary" size="sm" onClick={saveBl} disabled={numPending}>Enregistrer</Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Prochain bon : <span className="font-mono text-primary">{(Number(blVal) || 0) + 1}/{mm}/{yy}</span></p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Tags className="size-4 text-primary" /> Catégories de transactions</CardTitle>
            <CardDescription>Libellés utilisés dans la Trésorerie (salaires, fournisseurs, dépenses…). Ajoutez ou renommez-les librement.</CardDescription>
          </div>
          <Button onClick={openNew}><Plus className="size-4" /> Nouvelle catégorie</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Catégorie</TableHead>
                <TableHead>Sens</TableHead>
                <TableHead>État</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.length === 0 ? (
                <TableEmpty colSpan={4}>Aucune catégorie.</TableEmpty>
              ) : categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <span className="inline-flex items-center gap-2 font-medium text-foreground">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.name}
                      {c.is_system && <Badge variant="neutral">système</Badge>}
                    </span>
                  </TableCell>
                  <TableCell><Badge variant={c.direction === "in" ? "success" : c.direction === "out" ? "warning" : "neutral"}>{DIR_LABEL[c.direction]}</Badge></TableCell>
                  <TableCell>{c.active ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Inactive</Badge>}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)} aria-label="Modifier"><Pencil className="size-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(c)} aria-label="Supprimer" className="text-danger hover:text-danger"><Trash2 className="size-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Modifier la catégorie" : "Nouvelle catégorie"} className="max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <div><Label htmlFor="name">Nom *</Label><Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} required autoFocus placeholder="Ex : Transport, Électricité…" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="direction">Sens par défaut</Label>
              <Select id="direction" value={form.direction} onChange={(e) => set("direction", e.target.value as CategoryInput["direction"])}>
                <option value="out">Sortie (dépense)</option>
                <option value="in">Entrée (recette)</option>
                <option value="both">Les deux</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="color">Couleur</Label>
              <div className="flex items-center gap-2">
                <input id="color" type="color" value={form.color} onChange={(e) => set("color", e.target.value)} className="h-9 w-12 cursor-pointer rounded-md border border-border bg-input" />
                <Input value={form.color} onChange={(e) => set("color", e.target.value)} className="font-mono text-xs" />
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} className="size-4 accent-[var(--primary)]" />
            Catégorie active (proposée à la saisie)
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
