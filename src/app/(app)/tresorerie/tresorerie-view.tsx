"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Search, TrendingUp, TrendingDown, Scale, Settings } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/ui/modal";
import { Checkbox } from "@/components/ui/checkbox";
import { SelectionBar } from "@/components/ui/selection-bar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty,
} from "@/components/ui/table";
import { useSelection } from "@/hooks/use-selection";
import { formatDZD, formatDate, todayISO } from "@/lib/format";
import type { Transaction, TransactionCategory } from "@/lib/supabase/types";
import { saveTransaction, deleteTransactions, type TransactionInput } from "./actions";

const emptyForm = (): TransactionInput => ({
  date: todayISO(), direction: "out", montant: "", category_id: "", tiers: "", reference: "", description: "",
});

export function TresorerieView({
  transactions, categories,
}: { transactions: Transaction[]; categories: TransactionCategory[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [form, setForm] = useState<TransactionInput>(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (filterCat && t.category_id !== filterCat) return false;
      if (!q) return true;
      return (t.tiers ?? "").toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q);
    });
  }, [transactions, search, filterCat]);

  const sel = useSelection(filtered.map((t) => t.id));

  const totals = useMemo(() => {
    let inn = 0, out = 0;
    for (const t of transactions) {
      if (t.direction === "in") inn += Number(t.montant);
      else out += Number(t.montant);
    }
    return { inn, out, net: inn - out };
  }, [transactions]);

  function set<K extends keyof TransactionInput>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  function pickCategory(id: string) {
    const cat = catById.get(id);
    setForm((f) => ({
      ...f,
      category_id: id,
      direction: cat && cat.direction !== "both" ? cat.direction : f.direction,
    }));
  }

  function openNew() { setEditing(null); setForm(emptyForm()); setError(null); setOpen(true); }
  function openEdit(t: Transaction) {
    setEditing(t);
    setForm({
      date: t.date, direction: t.direction, montant: String(t.montant),
      category_id: t.category_id ?? "", tiers: t.tiers ?? "", reference: t.reference ?? "",
      description: t.description ?? "",
    });
    setError(null); setOpen(true);
  }
  function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    start(async () => {
      const res = await saveTransaction(editing?.id ?? null, form);
      if (res.ok) setOpen(false); else setError(res.error);
    });
  }
  function bulkDelete() {
    if (!confirm(`Supprimer ${sel.count} transaction(s) ?`)) return;
    start(async () => {
      const res = await deleteTransactions(sel.selected);
      if (res.ok) sel.clear(); else alert(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trésorerie"
        description="Dépenses, salaires, achats fournisseurs et entrées diverses"
        actions={
          <>
            <Link href="/parametres">
              <Button variant="outline" size="sm"><Settings className="size-4" /> Catégories</Button>
            </Link>
            <Button onClick={openNew}><Plus className="size-4" /> Nouvelle transaction</Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total entrées" value={formatDZD(totals.inn)} icon={TrendingUp} accent="success" />
        <StatCard label="Total sorties" value={formatDZD(totals.out)} icon={TrendingDown} accent="danger" />
        <StatCard label="Solde net" value={formatDZD(totals.net)} icon={Scale} accent={totals.net >= 0 ? "success" : "warning"} />
      </div>

      <Card>
        <CardHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Registre des transactions</CardTitle>
          <div className="flex gap-2">
            <Select className="h-8 w-48" value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
              <option value="">Toutes les catégories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <div className="relative w-48">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-8 pl-9" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-9">
                  <Checkbox checked={sel.allChecked} indeterminate={sel.someChecked} onChange={sel.toggleAll} aria-label="Tout sélectionner" />
                </TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Tiers</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableEmpty colSpan={6}>Aucune transaction.</TableEmpty>
              ) : filtered.map((t) => {
                const cat = t.category_id ? catById.get(t.category_id) : null;
                return (
                  <TableRow key={t.id} className="cursor-pointer" onClick={() => openEdit(t)}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={sel.isSelected(t.id)} onChange={() => sel.toggle(t.id)} aria-label="Sélectionner" />
                    </TableCell>
                    <TableCell className="text-muted whitespace-nowrap">{formatDate(t.date)}</TableCell>
                    <TableCell>
                      {cat ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
                          <span className="size-2 rounded-full" style={{ backgroundColor: cat.color }} />
                          {cat.name}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-muted">{t.tiers ?? "—"}</TableCell>
                    <TableCell className="max-w-[260px] truncate text-muted">{t.description ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium whitespace-nowrap">
                      <span className={t.direction === "in" ? "text-success" : "text-danger"}>
                        {t.direction === "in" ? "+" : "−"} {formatDZD(t.montant)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Modifier la transaction" : "Nouvelle transaction"} className="max-w-xl">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="category_id">Catégorie</Label>
              <Select id="category_id" value={form.category_id ?? ""} onChange={(e) => pickCategory(e.target.value)}>
                <option value="">— Sans catégorie —</option>
                {categories.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="direction">Sens</Label>
              <Select id="direction" value={form.direction} onChange={(e) => set("direction", e.target.value)}>
                <option value="out">Sortie (dépense)</option>
                <option value="in">Entrée (recette)</option>
              </Select>
            </div>
            <div><Label htmlFor="montant">Montant (DA) *</Label><Input id="montant" inputMode="decimal" value={form.montant} onChange={(e) => set("montant", e.target.value)} required autoFocus /></div>
            <div><Label htmlFor="date">Date</Label><Input id="date" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} /></div>
            <div><Label htmlFor="tiers">Tiers / bénéficiaire</Label><Input id="tiers" value={form.tiers ?? ""} onChange={(e) => set("tiers", e.target.value)} placeholder="Fournisseur, employé…" /></div>
            <div><Label htmlFor="reference">Référence</Label><Input id="reference" value={form.reference ?? ""} onChange={(e) => set("reference", e.target.value)} placeholder="N° facture, chèque…" /></div>
            <div className="sm:col-span-2"><Label htmlFor="description">Description</Label><Textarea id="description" rows={2} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} /></div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>
          </div>
        </form>
      </Modal>

      <SelectionBar count={sel.count} noun="transaction" onClear={sel.clear} onDelete={bulkDelete} pending={pending} />
    </div>
  );
}
