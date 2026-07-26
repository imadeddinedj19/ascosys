"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, ArrowLeft, FileText, CheckCircle2, Wallet, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/layout/page-header";
import { formatDZD, formatDate, todayISO } from "@/lib/format";
import type { Prospect, ProformaStatut, ProspectDeposit, OrderShift } from "@/lib/supabase/types";
import type { ProductOption } from "@/lib/data/catalog";
import {
  saveProforma, addDeposit, deleteDeposit, validateProforma,
  type DevisHeader, type DevisLineInput,
} from "@/app/(app)/devis/actions";

export type DevisInitial = {
  id: string;
  numero: string;
  prospect_id: string | null;
  date: string;
  tva_rate: number;
  statut: ProformaStatut;
  notes: string | null;
  lines: DevisLineInput[];
  deposits: ProspectDeposit[];
};

const emptyLine = (): DevisLineInput => ({ product_id: "", designation: "", quantite: "", prix_unitaire: "" });
const DEFAULT_NOTES = "* Versement 20% à la commande\n* Délai de livraison : 20 jours";

export function DevisEditor({
  prospects, products, initial, defaultProspectId,
}: { prospects: Prospect[]; products: ProductOption[]; initial?: DevisInitial; defaultProspectId?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [header, setHeader] = useState<DevisHeader>({
    prospect_id: initial?.prospect_id ?? defaultProspectId ?? "",
    date: initial?.date ?? todayISO(),
    tva_rate: initial ? String(initial.tva_rate) : "0.19",
    statut: initial?.statut ?? "brouillon",
    notes: initial?.notes ?? DEFAULT_NOTES,
  });
  const [lines, setLines] = useState<DevisLineInput[]>(initial?.lines?.length ? initial.lines : [emptyLine()]);

  const prospectOptions = useMemo(() => prospects.map((p) => ({ value: p.id, label: p.name })), [prospects]);
  const productOptions = useMemo(() => products.map((p) => ({ value: p.id, label: p.name })), [products]);
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const [depOpen, setDepOpen] = useState(false);
  const [dep, setDep] = useState({ date: todayISO(), montant: "", mode: "espece", note: "" });
  const [valOpen, setValOpen] = useState(false);
  const [val, setVal] = useState<{ date_prevue: string; shift: OrderShift }>({ date_prevue: "", shift: "matin" });

  function setH<K extends keyof DevisHeader>(k: K, v: string) { setHeader((h) => ({ ...h, [k]: v })); }
  function setLine(i: number, patch: Partial<DevisLineInput>) { setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l))); }
  function onPickProduct(i: number, productId: string) {
    const p = productById.get(productId);
    setLine(i, { product_id: productId, designation: p ? p.name : lines[i].designation, prix_unitaire: p?.prix_unitaire != null ? String(p.prix_unitaire) : lines[i].prix_unitaire });
  }
  function addLine() { setLines((ls) => [...ls, emptyLine()]); }
  function removeLine(i: number) { setLines((ls) => (ls.length === 1 ? ls : ls.filter((_, idx) => idx !== i))); }

  const num = (v: string) => { const x = Number((v ?? "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };
  const totals = useMemo(() => {
    const ht = lines.reduce((s, l) => s + num(l.quantite) * num(l.prix_unitaire), 0);
    const tva = ht * num(header.tva_rate);
    return { ht, tva, ttc: ht + tva };
  }, [lines, header.tva_rate]);

  const deposits = initial?.deposits ?? [];
  const totalDeposits = deposits.reduce((s, d) => s + Number(d.montant), 0);
  const isValidated = initial?.statut === "valide";

  function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    start(async () => {
      const res = await saveProforma(initial?.id ?? null, header, lines);
      if (res.ok) router.push(`/devis/${res.id}`); else setError(res.error);
    });
  }
  function submitDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (!initial) return;
    start(async () => {
      const res = await addDeposit(header.prospect_id, initial.id, { date: dep.date, montant: dep.montant, mode: dep.mode as ProspectDeposit["mode"], note: dep.note || null });
      if (res.ok) { setDepOpen(false); setDep({ date: todayISO(), montant: "", mode: "espece", note: "" }); router.refresh(); }
      else alert(res.error);
    });
  }
  function removeDeposit(id: string) {
    if (!initial || !confirm("Supprimer cet acompte ?")) return;
    start(async () => { const res = await deleteDeposit(id, initial.id); if (res.ok) router.refresh(); else alert(res.error); });
  }
  function submitValidate(e: React.FormEvent) {
    e.preventDefault();
    if (!initial) return;
    start(async () => {
      const res = await validateProforma(initial.id, val);
      if (res.ok) { setValOpen(false); router.push("/devis"); } else alert(res.error);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <PageHeader
        title={initial ? `Devis ${initial.numero}` : "Nouveau devis"}
        description="Devis / facture proforma pour un prospect"
        actions={
          <>
            {initial && (
              <Link href={`/devis/${initial.id}/pdf`} target="_blank">
                <Button type="button" variant="secondary" size="sm"><FileText className="size-4" /> Proforma PDF</Button>
              </Link>
            )}
            {initial && !isValidated && (
              <Button type="button" variant="success" size="sm" onClick={() => setValOpen(true)}><CheckCircle2 className="size-4" /> Valider</Button>
            )}
            <Button type="button" variant="ghost" onClick={() => router.push("/devis")}><ArrowLeft className="size-4" /> Retour</Button>
          </>
        }
      />

      {isValidated && (
        <div className="rounded-md border border-success/30 bg-success/10 px-4 py-2 text-sm text-success">
          Devis validé — le client, les produits et les commandes en file d&apos;attente ont été créés.
        </div>
      )}

      <Card>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="prospect_id">Prospect *</Label>
            <Combobox id="prospect_id" value={header.prospect_id} onChange={(v) => setH("prospect_id", v)} options={prospectOptions} placeholder="— Sélectionner —" searchPlaceholder="Rechercher un prospect…" />
          </div>
          <div><Label htmlFor="date">Date</Label><Input id="date" type="date" value={header.date} onChange={(e) => setH("date", e.target.value)} /></div>
          <div>
            <Label htmlFor="statut">Statut</Label>
            <Select id="statut" value={header.statut} onChange={(e) => setH("statut", e.target.value)}>
              <option value="brouillon">Brouillon</option>
              <option value="envoye">Envoyé</option>
              <option value="refuse">Refusé</option>
              {isValidated && <option value="valide">Validé</option>}
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="hidden grid-cols-12 gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
            <span className="col-span-4">Produit</span>
            <span className="col-span-3">Désignation</span>
            <span className="col-span-2 text-right">Quantité</span>
            <span className="col-span-2 text-right">P.U (DA)</span>
            <span className="col-span-1 text-right">Total</span>
          </div>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 rounded-md border border-border/60 p-2 sm:grid-cols-12 sm:border-0 sm:p-0">
              <div className="sm:col-span-4"><Combobox value={l.product_id ?? ""} onChange={(v) => onPickProduct(i, v)} options={productOptions} placeholder="— Produit libre —" searchPlaceholder="Rechercher…" allowClear /></div>
              <div className="sm:col-span-3"><Input placeholder="Désignation" value={l.designation} onChange={(e) => setLine(i, { designation: e.target.value })} /></div>
              <div className="sm:col-span-2"><Input inputMode="decimal" placeholder="0" className="text-right" value={l.quantite} onChange={(e) => setLine(i, { quantite: e.target.value })} /></div>
              <div className="sm:col-span-2"><Input inputMode="decimal" placeholder="0" className="text-right" value={l.prix_unitaire} onChange={(e) => setLine(i, { prix_unitaire: e.target.value })} /></div>
              <div className="flex items-center justify-between gap-2 sm:col-span-1 sm:justify-end">
                <span className="truncate text-right text-sm text-muted">{formatDZD(num(l.quantite) * num(l.prix_unitaire))}</span>
                <button type="button" onClick={() => removeLine(i)} className="text-danger/70 hover:text-danger cursor-pointer" aria-label="Retirer"><Trash2 className="size-4" /></button>
              </div>
            </div>
          ))}
          <Button type="button" variant="secondary" size="sm" onClick={addLine}><Plus className="size-4" /> Ajouter une ligne</Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-5">
            <Label htmlFor="notes">Notes (conditions)</Label>
            <Textarea id="notes" rows={4} value={header.notes ?? ""} onChange={(e) => setH("notes", e.target.value)} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 pt-5 text-sm">
            <div className="flex items-center justify-between"><span className="text-muted">Total HT</span><span className="font-medium text-foreground">{formatDZD(totals.ht)}</span></div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-muted">TVA<Input className="h-7 w-20 text-right text-xs" inputMode="decimal" value={header.tva_rate} onChange={(e) => setH("tva_rate", e.target.value)} /><span className="text-xs text-muted-foreground">({(num(header.tva_rate) * 100).toFixed(0)} %)</span></span>
              <span className="font-medium text-foreground">{formatDZD(totals.tva)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-2 text-base"><span className="font-semibold text-foreground">Total TTC</span><span className="font-semibold text-primary text-glow">{formatDZD(totals.ttc)}</span></div>
          </CardContent>
        </Card>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push("/devis")}>Annuler</Button>
        <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>
      </div>

      {/* Acomptes (après enregistrement) */}
      {initial && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Wallet className="size-4 text-primary" /> Acomptes / versements</CardTitle>
            <Button type="button" variant="secondary" size="sm" onClick={() => setDepOpen(true)}><Plus className="size-4" /> Ajouter un versement</Button>
          </CardHeader>
          <CardContent>
            {deposits.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun acompte. Les versements sont reportés en paiements du client à la validation.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {deposits.map((d) => (
                  <li key={d.id} className="flex items-center justify-between rounded-md bg-surface-2/40 px-3 py-2">
                    <span className="flex items-center gap-3">
                      <span className="text-muted">{formatDate(d.date)}</span>
                      <Badge variant="neutral">{d.mode}</Badge>
                      <span className="font-medium text-success">{formatDZD(d.montant)}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <Link href={`/versement?deposit=${d.id}`} target="_blank" className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><Receipt className="size-3.5" /> Bon de versement</Link>
                      <button type="button" onClick={() => removeDeposit(d.id)} className="text-danger/70 hover:text-danger cursor-pointer" aria-label="Supprimer"><Trash2 className="size-4" /></button>
                    </span>
                  </li>
                ))}
                <li className="flex items-center justify-between px-3 pt-1 text-sm"><span className="text-muted">Total acomptes</span><span className="font-semibold text-foreground">{formatDZD(totalDeposits)}</span></li>
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Modal open={depOpen} onClose={() => setDepOpen(false)} title="Nouveau versement (acompte)" className="max-w-md">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="dep_montant">Montant (DA) *</Label><Input id="dep_montant" inputMode="decimal" value={dep.montant} onChange={(e) => setDep((d) => ({ ...d, montant: e.target.value }))} autoFocus /></div>
            <div><Label htmlFor="dep_date">Date</Label><Input id="dep_date" type="date" value={dep.date} onChange={(e) => setDep((d) => ({ ...d, date: e.target.value }))} /></div>
            <div className="sm:col-span-2">
              <Label htmlFor="dep_mode">Mode</Label>
              <Select id="dep_mode" value={dep.mode} onChange={(e) => setDep((d) => ({ ...d, mode: e.target.value }))}>
                <option value="espece">Espèces</option><option value="cheque">Chèque</option><option value="virement">Virement</option>
              </Select>
            </div>
            <div className="sm:col-span-2"><Label htmlFor="dep_note">Note</Label><Input id="dep_note" value={dep.note} onChange={(e) => setDep((d) => ({ ...d, note: e.target.value }))} /></div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDepOpen(false)}>Annuler</Button>
            <Button type="button" onClick={submitDeposit} disabled={pending}>Enregistrer</Button>
          </div>
        </div>
      </Modal>

      <Modal open={valOpen} onClose={() => setValOpen(false)} title="Valider le devis" className="max-w-md">
        <div className="space-y-4">
          <p className="text-sm text-muted">Crée le client, les produits et les commandes en file d&apos;attente. Renseignez les infos de production :</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="val_date">Date prévue de livraison</Label><Input id="val_date" type="date" value={val.date_prevue} onChange={(e) => setVal((v) => ({ ...v, date_prevue: e.target.value }))} /></div>
            <div>
              <Label htmlFor="val_shift">Shift</Label>
              <Select id="val_shift" value={val.shift} onChange={(e) => setVal((v) => ({ ...v, shift: e.target.value as OrderShift }))}>
                <option value="matin">Matin</option><option value="soir">Soir</option>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setValOpen(false)}>Annuler</Button>
            <Button type="button" variant="success" onClick={submitValidate} disabled={pending}>{pending ? "Validation…" : "Valider le devis"}</Button>
          </div>
        </div>
      </Modal>
    </form>
  );
}
