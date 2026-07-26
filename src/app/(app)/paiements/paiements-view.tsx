"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Search, Wallet, TrendingUp, Users, Pencil, Check, X, Receipt } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Checkbox } from "@/components/ui/checkbox";
import { SelectionBar } from "@/components/ui/selection-bar";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty,
} from "@/components/ui/table";
import { useSelection } from "@/hooks/use-selection";
import { formatDZD, formatDate, todayISO } from "@/lib/format";
import type { Payment, Client, ClientBalance, SalesDocument, PaymentMode } from "@/lib/supabase/types";
import { savePayment, deletePayments, updateOpeningBalance, type PaymentInput } from "./actions";

const MODE_LABEL: Record<PaymentMode, string> = { espece: "Espèces", cheque: "Chèque", virement: "Virement" };

export function PaiementsView({
  payments, clients, balances, documents,
}: { payments: Payment[]; clients: Client[]; balances: ClientBalance[]; documents: SalesDocument[] }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [paySearch, setPaySearch] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<PaymentInput>({
    client_id: "", document_id: "", date: todayISO(), montant: "", mode: "espece", reference: "", note: "",
  });
  const [editBal, setEditBal] = useState<{ id: string; value: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"soldes" | "paiements">("soldes");

  const clientName = useMemo(() => new Map(clients.map((c) => [c.id, c.company_name])), [clients]);

  const totalSolde = useMemo(() => balances.reduce((s, b) => s + Number(b.solde), 0), [balances]);
  const debtorCount = useMemo(() => balances.filter((b) => Number(b.solde) > 0).length, [balances]);

  const sortedBalances = useMemo(
    () => [...balances].sort((a, b) => Number(b.solde) - Number(a.solde)),
    [balances],
  );
  const filteredBalances = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedBalances;
    return sortedBalances.filter((b) => b.company_name.toLowerCase().includes(q));
  }, [sortedBalances, search]);

  const filteredPayments = useMemo(() => {
    const q = paySearch.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter((p) => (clientName.get(p.client_id) ?? "").toLowerCase().includes(q));
  }, [payments, paySearch, clientName]);

  const sel = useSelection(filteredPayments.map((p) => p.id));

  const clientDocs = useMemo(
    () => documents.filter((d) => d.client_id === form.client_id),
    [documents, form.client_id],
  );

  function set<K extends keyof PaymentInput>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  function openNew() {
    setEditingId(null);
    setForm({ client_id: "", document_id: "", date: todayISO(), montant: "", mode: "espece", reference: "", note: "" });
    setError(null); setOpen(true);
  }
  function openEdit(p: Payment) {
    setEditingId(p.id);
    setForm({
      client_id: p.client_id, document_id: p.document_id ?? "", date: p.date,
      montant: String(p.montant), mode: p.mode, reference: p.reference ?? "", note: p.note ?? "",
    });
    setError(null); setOpen(true);
  }
  function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    start(async () => { const res = await savePayment(editingId, form); if (res.ok) setOpen(false); else setError(res.error); });
  }
  function bulkDelete() {
    if (!confirm(`Supprimer ${sel.count} paiement(s) ?`)) return;
    start(async () => { const res = await deletePayments(sel.selected); if (res.ok) sel.clear(); else alert(res.error); });
  }
  function saveBalance() {
    if (!editBal) return;
    const { id, value } = editBal;
    start(async () => {
      const res = await updateOpeningBalance(id, value || "0");
      if (res.ok) setEditBal(null); else alert(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paiements & Solde"
        description="Enregistrez les paiements clients et suivez ce que chaque client vous doit"
        actions={<Button onClick={openNew}><Plus className="size-4" /> Nouveau paiement</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total dû par les clients" value={formatDZD(totalSolde)} icon={TrendingUp} accent={totalSolde > 0 ? "warning" : "success"} />
        <StatCard label="Clients débiteurs" value={String(debtorCount)} icon={Users} />
        <StatCard label="Paiements enregistrés" value={String(payments.length)} icon={Wallet} accent="success" />
      </div>

      {/* Sous-onglets */}
      <div className="flex gap-1 rounded-lg border border-border bg-surface-2/40 p-1">
        {([["soldes", "Soldes clients"], ["paiements", "Journal des paiements"]] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={
              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer " +
              (tab === key ? "bg-primary/15 text-primary" : "text-muted hover:text-foreground")
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Section 2 — Soldes clients (qui doit combien) */}
      {tab === "soldes" && (
      <Card>
        <CardHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Soldes clients</CardTitle>
            <CardDescription>Solde d&apos;ouverture + ventes − paiements. Modifiez le solde d&apos;ouverture pour fixer la dette réelle de départ.</CardDescription>
          </div>
          <div className="relative w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-8 pl-9" placeholder="Rechercher un client…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Solde d&apos;ouverture</TableHead>
                <TableHead className="text-right">Ventes</TableHead>
                <TableHead className="text-right">Payé</TableHead>
                <TableHead className="text-right">Solde dû</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBalances.length === 0 ? (
                <TableEmpty colSpan={5}>Aucun client.</TableEmpty>
              ) : filteredBalances.map((b) => (
                <TableRow key={b.client_id}>
                  <TableCell className="font-medium text-foreground">{b.company_name}</TableCell>
                  <TableCell className="text-right">
                    {editBal?.id === b.client_id ? (
                      <span className="flex items-center justify-end gap-1">
                        <Input
                          className="h-7 w-28 text-right text-xs"
                          inputMode="decimal"
                          autoFocus
                          value={editBal.value}
                          onChange={(e) => setEditBal({ id: b.client_id, value: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Enter") saveBalance(); if (e.key === "Escape") setEditBal(null); }}
                        />
                        <button type="button" onClick={saveBalance} className="text-success cursor-pointer" aria-label="Valider"><Check className="size-4" /></button>
                        <button type="button" onClick={() => setEditBal(null)} className="text-muted cursor-pointer" aria-label="Annuler"><X className="size-4" /></button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditBal({ id: b.client_id, value: String(b.solde_ouverture ?? 0) })}
                        className="inline-flex items-center gap-1.5 text-muted hover:text-primary cursor-pointer"
                      >
                        {formatDZD(b.solde_ouverture ?? 0)} <Pencil className="size-3 opacity-60" />
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted">{formatDZD(b.total_facture)}</TableCell>
                  <TableCell className="text-right text-muted">{formatDZD(b.total_paye)}</TableCell>
                  <TableCell className="text-right font-medium">
                    <span className={Number(b.solde) > 0 ? "text-warning" : Number(b.solde) < 0 ? "text-danger" : "text-success"}>{formatDZD(b.solde)}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      )}

      {/* Section 1 — Journal des paiements */}
      {tab === "paiements" && (
      <Card>
        <CardHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Journal des paiements</CardTitle>
          <div className="relative w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-8 pl-9" placeholder="Rechercher un client…" value={paySearch} onChange={(e) => setPaySearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-9"><Checkbox checked={sel.allChecked} indeterminate={sel.someChecked} onChange={sel.toggleAll} aria-label="Tout sélectionner" /></TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Référence</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead className="text-right">Reçu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.length === 0 ? (
                <TableEmpty colSpan={7}>Aucun paiement enregistré.</TableEmpty>
              ) : filteredPayments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell><Checkbox checked={sel.isSelected(p.id)} onChange={() => sel.toggle(p.id)} aria-label="Sélectionner" /></TableCell>
                  <TableCell className="text-muted whitespace-nowrap">{formatDate(p.date)}</TableCell>
                  <TableCell className="text-foreground">{clientName.get(p.client_id) ?? "—"}</TableCell>
                  <TableCell><Badge variant="neutral">{MODE_LABEL[p.mode]}</Badge></TableCell>
                  <TableCell className="text-muted">{p.reference ?? "—"}</TableCell>
                  <TableCell className="text-right font-medium text-success">{formatDZD(p.montant)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" onClick={() => openEdit(p)} className="text-muted hover:text-primary cursor-pointer" aria-label="Modifier le paiement"><Pencil className="size-4" /></button>
                      <Link href={`/versement?payment=${p.id}`} target="_blank" className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><Receipt className="size-3.5" /> PDF</Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editingId ? "Modifier le paiement" : "Nouveau paiement"} className="max-w-xl">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="client_id">Client *</Label>
              <Combobox
                id="client_id"
                value={form.client_id}
                onChange={(v) => set("client_id", v)}
                options={clients.map((c) => ({ value: c.id, label: c.company_name }))}
                placeholder="— Sélectionner —"
                searchPlaceholder="Rechercher un client…"
              />
            </div>
            <div><Label htmlFor="montant">Montant (DA) *</Label><Input id="montant" inputMode="decimal" value={form.montant} onChange={(e) => set("montant", e.target.value)} required autoFocus /></div>
            <div><Label htmlFor="date">Date</Label><Input id="date" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} /></div>
            <div>
              <Label htmlFor="mode">Mode</Label>
              <Select id="mode" value={form.mode} onChange={(e) => set("mode", e.target.value)}>
                <option value="espece">Espèces</option>
                <option value="cheque">Chèque</option>
                <option value="virement">Virement</option>
              </Select>
            </div>
            <div><Label htmlFor="reference">Référence</Label><Input id="reference" value={form.reference ?? ""} onChange={(e) => set("reference", e.target.value)} placeholder="N° chèque…" /></div>
            <div className="sm:col-span-2">
              <Label htmlFor="document_id">Document lié (optionnel)</Label>
              <Select id="document_id" value={form.document_id ?? ""} onChange={(e) => set("document_id", e.target.value)} disabled={!form.client_id}>
                <option value="">— Aucun —</option>
                {clientDocs.map((d) => <option key={d.id} value={d.id}>{d.numero} — {formatDZD(d.total_ttc)}</option>)}
              </Select>
            </div>
            <div className="sm:col-span-2"><Label htmlFor="note">Note</Label><Textarea id="note" rows={2} value={form.note ?? ""} onChange={(e) => set("note", e.target.value)} /></div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>
          </div>
        </form>
      </Modal>

      {tab === "paiements" && <SelectionBar count={sel.count} noun="paiement" onClear={sel.clear} onDelete={bulkDelete} pending={pending} />}
    </div>
  );
}
