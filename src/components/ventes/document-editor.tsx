"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, ArrowLeft, FileText, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { formatDZD, todayISO } from "@/lib/format";
import { droitTimbreSiEspeces } from "@/lib/fiscal";
import type { Client } from "@/lib/supabase/types";
import type { ProductOption, PriceOverride } from "@/lib/data/catalog";
import {
  saveDocument,
  type DocumentInput,
  type LineInput,
} from "@/app/(app)/ventes/actions";

export type EditorMode = "facture" | "bon";

export type EditorDocument = {
  id: string;
  numero: string;
  date: string;
  client_id: string;
  type: EditorMode;
  tva_rate: number;
  paiement_mode: "espece" | "cheque" | "virement" | null;
  statut: "brouillon" | "valide" | "paye";
  notes: string | null;
  lines: LineInput[];
};

const emptyLine = (): LineInput => ({ product_id: "", designation: "", quantite: "", prix_unitaire: "" });

export function DocumentEditor({
  mode,
  clients,
  products,
  overrides = [],
  initial,
}: {
  mode: EditorMode;
  clients: Client[];
  products: ProductOption[];
  overrides?: PriceOverride[];
  initial?: EditorDocument;
}) {
  const router = useRouter();
  const isFacture = mode === "facture";
  const backHref = isFacture ? "/factures" : "/bons-livraison";
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [header, setHeader] = useState<DocumentInput>({
    date: initial?.date ?? todayISO(),
    client_id: initial?.client_id ?? "",
    type: mode,
    tva_rate: initial ? String(initial.tva_rate) : "0.19",
    // Un bon de livraison correspond à des marchandises livrées → compté par défaut.
    statut: initial?.statut ?? (mode === "bon" ? "valide" : "brouillon"),
    paiement_mode: initial?.paiement_mode ?? "",
    paye_livraison: "",
    notes: initial?.notes ?? "",
  });
  const [lines, setLines] = useState<LineInput[]>(initial?.lines?.length ? initial.lines : [emptyLine()]);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const clientOptions = useMemo<ComboOption[]>(() => clients.map((c) => ({ value: c.id, label: c.company_name })), [clients]);
  const productOptions = useMemo<ComboOption[]>(() => products.map((p) => ({ value: p.id, label: p.name })), [products]);
  const overrideMap = useMemo(
    () => new Map(overrides.map((o) => [`${o.product_id}:${o.client_id}`, o.prix_unitaire])),
    [overrides],
  );

  function resolvePrice(productId: string, clientId: string): number | null {
    if (clientId) {
      const ov = overrideMap.get(`${productId}:${clientId}`);
      if (ov != null) return ov;
    }
    return productById.get(productId)?.prix_unitaire ?? null;
  }

  function setH<K extends keyof DocumentInput>(k: K, v: string) { setHeader((h) => ({ ...h, [k]: v })); }

  function onClientChange(clientId: string) {
    setHeader((h) => ({ ...h, client_id: clientId }));
    setLines((ls) =>
      ls.map((l) => {
        if (!l.product_id) return l;
        const price = resolvePrice(l.product_id, clientId);
        return price != null ? { ...l, prix_unitaire: String(price) } : l;
      }),
    );
  }

  function setLine(i: number, patch: Partial<LineInput>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function onPickProduct(i: number, productId: string) {
    const p = productById.get(productId);
    const price = resolvePrice(productId, header.client_id);
    setLine(i, {
      product_id: productId,
      designation: p ? p.name : lines[i].designation,
      prix_unitaire: price != null ? String(price) : lines[i].prix_unitaire,
    });
  }
  function addLine() { setLines((ls) => [...ls, emptyLine()]); }
  function removeLine(i: number) { setLines((ls) => (ls.length === 1 ? ls : ls.filter((_, idx) => idx !== i))); }

  const num = (v: string) => { const x = Number((v ?? "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };
  const totals = useMemo(() => {
    const ht = lines.reduce((s, l) => s + num(l.quantite) * num(l.prix_unitaire), 0);
    const tva = isFacture ? ht * num(header.tva_rate) : 0;
    const ttcBase = ht + tva;
    const timbre = isFacture ? droitTimbreSiEspeces(ttcBase, header.paiement_mode || null) : 0;
    return { ht, tva, timbre, net: ttcBase + timbre };
  }, [lines, header.tva_rate, header.paiement_mode, isFacture]);

  function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    start(async () => {
      const res = await saveDocument(initial?.id ?? null, { ...header, type: mode }, lines);
      if (res.ok) router.push(`/ventes/${res.id}`);
      else setError(res.error);
    });
  }

  const title = initial
    ? `${isFacture ? "Facture" : "Bon de livraison"} ${initial.numero}`
    : isFacture ? "Nouvelle facture" : "Nouveau bon de livraison";

  return (
    <form onSubmit={submit} className="space-y-6">
      <PageHeader
        title={title}
        description={isFacture ? "Facture (TVA 19 % · droit de timbre en espèces)" : "Bon de livraison (sans TVA)"}
        actions={
          <>
            {initial && (
              <>
                {isFacture && (
                  <Link href={`/ventes/${initial.id}/facture`} target="_blank">
                    <Button type="button" variant="secondary" size="sm"><FileText className="size-4" /> Facture PDF</Button>
                  </Link>
                )}
                <Link href={`/ventes/${initial.id}/bon-livraison`} target="_blank">
                  <Button type="button" variant="secondary" size="sm"><Truck className="size-4" /> Bon de livraison</Button>
                </Link>
              </>
            )}
            <Button type="button" variant="ghost" onClick={() => router.push(backHref)}>
              <ArrowLeft className="size-4" /> Retour
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="client_id">Client *</Label>
            <Combobox id="client_id" value={header.client_id} onChange={onClientChange} options={clientOptions} placeholder="— Sélectionner —" searchPlaceholder="Rechercher un client…" />
          </div>
          <div><Label htmlFor="date">Date</Label><Input id="date" type="date" value={header.date} onChange={(e) => setH("date", e.target.value)} /></div>
          {isFacture && (
            <div>
              <Label htmlFor="paiement_mode">Mode de règlement</Label>
              <Select id="paiement_mode" value={header.paiement_mode} onChange={(e) => setH("paiement_mode", e.target.value)}>
                <option value="">— Non réglé —</option>
                <option value="espece">Espèces (+ droit de timbre)</option>
                <option value="cheque">Chèque</option>
                <option value="virement">Virement</option>
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="statut">Statut</Label>
            <Select id="statut" value={header.statut} onChange={(e) => setH("statut", e.target.value)}>
              <option value="brouillon">Brouillon</option>
              <option value="valide">Validé</option>
              <option value="paye">Payé</option>
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
              <div className="sm:col-span-4">
                <Combobox
                  value={l.product_id ?? ""}
                  onChange={(v) => onPickProduct(i, v)}
                  options={productOptions}
                  placeholder="— Produit libre —"
                  searchPlaceholder="Rechercher un produit…"
                  allowClear
                />
              </div>
              <div className="sm:col-span-3"><Input placeholder="Désignation" value={l.designation} onChange={(e) => setLine(i, { designation: e.target.value })} /></div>
              <div className="sm:col-span-2"><Input inputMode="decimal" placeholder="0" className="text-right" value={l.quantite} onChange={(e) => setLine(i, { quantite: e.target.value })} /></div>
              <div className="sm:col-span-2"><Input inputMode="decimal" placeholder="0" className="text-right" value={l.prix_unitaire} onChange={(e) => setLine(i, { prix_unitaire: e.target.value })} /></div>
              <div className="flex items-center justify-between gap-2 sm:col-span-1 sm:justify-end">
                <span className="text-sm font-medium text-foreground sm:hidden">Total</span>
                <span className="truncate text-right text-sm text-muted">{formatDZD(num(l.quantite) * num(l.prix_unitaire))}</span>
                <button type="button" onClick={() => removeLine(i)} className="text-danger/70 hover:text-danger cursor-pointer" aria-label="Retirer la ligne">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
          <Button type="button" variant="secondary" size="sm" onClick={addLine}>
            <Plus className="size-4" /> Ajouter une ligne
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 pt-5">
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" rows={3} value={header.notes ?? ""} onChange={(e) => setH("notes", e.target.value)} placeholder="Observations, conditions…" />
            </div>
            {!isFacture && !initial && (
              <div>
                <Label htmlFor="paye_livraison">Montant payé à la livraison (DA)</Label>
                <Input id="paye_livraison" inputMode="decimal" value={header.paye_livraison} onChange={(e) => setH("paye_livraison", e.target.value)} placeholder="0" />
                <p className="mt-1 text-xs text-muted-foreground">Enregistré comme paiement du client et déduit de son solde.</p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 pt-5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted">Total HT</span>
              <span className="font-medium text-foreground">{formatDZD(totals.ht)}</span>
            </div>
            {isFacture && (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-muted">
                    TVA
                    <Input className="h-7 w-20 text-right text-xs" inputMode="decimal" value={header.tva_rate} onChange={(e) => setH("tva_rate", e.target.value)} />
                    <span className="text-xs text-muted-foreground">({(num(header.tva_rate) * 100).toFixed(0)} %)</span>
                  </span>
                  <span className="font-medium text-foreground">{formatDZD(totals.tva)}</span>
                </div>
                {totals.timbre > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Droit de timbre (espèces)</span>
                    <span className="font-medium text-foreground">{formatDZD(totals.timbre)}</span>
                  </div>
                )}
              </>
            )}
            <div className="flex items-center justify-between border-t border-border pt-2 text-base">
              <span className="font-semibold text-foreground">{isFacture ? "Net à payer" : "Total"}</span>
              <span className="font-semibold text-primary text-glow">{formatDZD(totals.net)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push(backHref)}>Annuler</Button>
        <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>
      </div>
    </form>
  );
}
