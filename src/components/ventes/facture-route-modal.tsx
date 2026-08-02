"use client";

import { useEffect, useMemo, useState } from "react";
import { Percent, ReceiptText, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDZD } from "@/lib/format";
import { droitTimbreSiEspeces } from "@/lib/fiscal";
import type { PaymentMode } from "@/lib/supabase/types";
import {
  getFictivePricesForClient,
  getSuggestedNumero,
} from "@/app/(app)/ventes/actions";

export type BonLineForRoute = {
  id: string;
  product_id: string | null;
  designation: string;
  quantite: number;
  prix_reel: number;
};

type Row = {
  key: string;
  product_id: string | null;
  designation: string;
  quantite: number;
  prix_reel: number;
  prix_fictif: string;
};

const DEFAULT_DISCOUNT = 45.0;

const round1 = (n: number) => Math.round(n * 10) / 10;
const num = (v: string) => {
  const x = Number((v ?? "").replace(",", "."));
  return Number.isFinite(x) ? x : 0;
};
const applyDiscount = (prixReel: number, discountPct: number) =>
  round1(prixReel * (1 - discountPct / 100));

export function FactureRouteModal({
  open,
  onClose,
  clientId,
  bonLines,
  suggestedDate,
}: {
  open: boolean;
  onClose: () => void;
  clientId: string;
  bonLines: BonLineForRoute[];
  suggestedDate: string;
}) {
  const [numeroFacture, setNumeroFacture] = useState("");
  const [numeroBon, setNumeroBon] = useState("");
  const [date, setDate] = useState(suggestedDate);
  const [tvaRate, setTvaRate] = useState("0.19");
  const [paiementMode, setPaiementMode] = useState<PaymentMode | "">("");
  const [discount, setDiscount] = useState(String(DEFAULT_DISCOUNT));
  const [savePrices, setSavePrices] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoaded(false);
    setDate(suggestedDate);

    (async () => {
      const [saved, suggF, suggB] = await Promise.all([
        getFictivePricesForClient(clientId),
        getSuggestedNumero("facture"),
        getSuggestedNumero("bon"),
      ]);
      setNumeroFacture(suggF);
      setNumeroBon(suggB);
      const initial: Row[] = bonLines.map((l) => {
        const savedPrice = l.product_id ? saved[l.product_id] : undefined;
        const fictif =
          savedPrice != null && savedPrice > 0
            ? round1(savedPrice)
            : applyDiscount(l.prix_reel, DEFAULT_DISCOUNT);
        return {
          key: l.id,
          product_id: l.product_id,
          designation: l.designation,
          quantite: l.quantite,
          prix_reel: l.prix_reel,
          prix_fictif: String(fictif),
        };
      });
      setRows(initial);
      setLoaded(true);
    })();
  }, [open, clientId, bonLines, suggestedDate]);

  function applyGlobalDiscount(pct: string) {
    setDiscount(pct);
    const p = Number((pct ?? "").replace(",", "."));
    if (!Number.isFinite(p)) return;
    setRows((rs) =>
      rs.map((r) => ({ ...r, prix_fictif: String(applyDiscount(r.prix_reel, p)) })),
    );
  }

  function setRowPrice(i: number, v: string) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, prix_fictif: v } : r)));
  }

  const totalsFacture = useMemo(() => {
    const ht = rows.reduce((s, r) => s + r.quantite * num(r.prix_fictif), 0);
    const tva = ht * num(tvaRate);
    const ttcBase = ht + tva;
    const timbre = droitTimbreSiEspeces(ttcBase, paiementMode || null);
    return { ht, tva, timbre, net: ttcBase + timbre };
  }, [rows, tvaRate, paiementMode]);

  const totalBon = useMemo(
    () => rows.reduce((s, r) => s + r.quantite * num(r.prix_fictif), 0),
    [rows],
  );

  // Payload envoyé à /route-pdf/{facture|bon}. Recalculé à chaque rendu :
  // le champ hidden expose donc TOUJOURS les valeurs courantes du formulaire.
  const buildPayload = (numero: string) =>
    JSON.stringify({
      clientId,
      numero: numero.trim(),
      date,
      tva_rate: num(tvaRate),
      paiement_mode: paiementMode || null,
      notes: null,
      save_prices: savePrices,
      lines: rows.map((r) => ({
        product_id: r.product_id,
        designation: r.designation,
        quantite: r.quantite,
        prix_unitaire: num(r.prix_fictif),
      })),
    });

  const canSubmit = loaded && rows.length > 0 && clientId;

  return (
    <Modal open={open} onClose={onClose} title="Facture / BL de route" className="max-w-3xl">
      <div className="space-y-5">
        <p className="text-xs text-muted-foreground">
          Génère des PDF à la volée (prix réduits par défaut −{DEFAULT_DISCOUNT}%).
          <strong className="ml-1 text-foreground">Aucun document n&apos;est enregistré</strong>
          {" "}dans le CRM — seuls les prix par client sont mémorisés pour rappel automatique.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="fr_numero_f">Numéro facture</Label>
            <Input id="fr_numero_f" value={numeroFacture} onChange={(e) => setNumeroFacture(e.target.value)} placeholder="24/26" />
          </div>
          <div>
            <Label htmlFor="fr_numero_b">Numéro BL</Label>
            <Input id="fr_numero_b" value={numeroBon} onChange={(e) => setNumeroBon(e.target.value)} placeholder="40/07/26" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="fr_date">Date</Label>
            <Input id="fr_date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="fr_mode">Règlement (facture)</Label>
            <Select id="fr_mode" value={paiementMode} onChange={(e) => setPaiementMode(e.target.value as PaymentMode | "")}>
              <option value="">— Non réglé —</option>
              <option value="espece">Espèces (+ droit de timbre)</option>
              <option value="cheque">Chèque</option>
              <option value="virement">Virement</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="fr_tva">TVA (facture)</Label>
            <Input id="fr_tva" inputMode="decimal" value={tvaRate} onChange={(e) => setTvaRate(e.target.value)} />
          </div>
        </div>

        <div>
          <Label htmlFor="fr_discount" className="flex items-center gap-1"><Percent className="size-3" /> Réduction (%)</Label>
          <div className="flex items-center gap-2">
            <Input id="fr_discount" inputMode="decimal" className="max-w-[160px]" value={discount} onChange={(e) => applyGlobalDiscount(e.target.value)} />
            <span className="text-xs text-muted-foreground">Recalcule tous les prix ci-dessous.</span>
          </div>
        </div>

        <div className="rounded-md border border-border">
          <div className="hidden grid-cols-12 gap-2 border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
            <span className="col-span-5">Désignation</span>
            <span className="col-span-2 text-right">Qté</span>
            <span className="col-span-2 text-right">Prix réel</span>
            <span className="col-span-3 text-right">Prix fictif (DA)</span>
          </div>
          {!loaded ? (
            <div className="px-3 py-4 text-sm text-muted-foreground">Chargement des prix…</div>
          ) : rows.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground">Aucune ligne à générer.</div>
          ) : (
            rows.map((r, i) => (
              <div key={r.key} className="grid grid-cols-12 gap-2 border-b border-border/60 px-3 py-2 last:border-0">
                <div className="col-span-5 truncate text-sm text-foreground">{r.designation}</div>
                <div className="col-span-2 text-right text-sm text-muted">{r.quantite}</div>
                <div className="col-span-2 text-right text-sm text-muted">{formatDZD(r.prix_reel)}</div>
                <div className="col-span-3">
                  <Input inputMode="decimal" className="text-right" value={r.prix_fictif} onChange={(e) => setRowPrice(i, e.target.value)} />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md bg-surface-2/40 px-3 py-2 text-sm">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aperçu facture</div>
            <div className="flex items-center justify-between"><span className="text-muted">Total HT</span><span className="font-medium">{formatDZD(totalsFacture.ht)}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted">TVA</span><span className="font-medium">{formatDZD(totalsFacture.tva)}</span></div>
            {totalsFacture.timbre > 0 && (
              <div className="flex items-center justify-between"><span className="text-muted">Droit de timbre</span><span className="font-medium">{formatDZD(totalsFacture.timbre)}</span></div>
            )}
            <div className="mt-1 flex items-center justify-between border-t border-border pt-1">
              <span className="font-semibold">Net à payer</span><span className="font-semibold text-primary">{formatDZD(totalsFacture.net)}</span>
            </div>
          </div>
          <div className="rounded-md bg-surface-2/40 px-3 py-2 text-sm">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aperçu BL</div>
            <div className="flex items-center justify-between"><span className="text-muted">Total (sans TVA)</span><span className="font-medium">{formatDZD(totalBon)}</span></div>
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={savePrices} onChange={setSavePrices} />
          <span className="text-muted-foreground">
            Enregistrer ces prix pour ce client (rappelés automatiquement au prochain BL).
          </span>
        </label>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="outline" onClick={onClose}>Fermer</Button>
          <div className="flex flex-wrap gap-2">
            {/* FORM BL — POST /route-pdf/bon, target=_blank ouvre le PDF dans un nouvel onglet */}
            <form method="POST" action="/route-pdf/bon" target="_blank" className="contents">
              <input type="hidden" name="payload" value={buildPayload(numeroBon)} />
              <Button type="submit" variant="secondary" disabled={!canSubmit}>
                <Truck className="size-4" /> Générer le bon de livraison
              </Button>
            </form>

            {/* FORM FACTURE */}
            <form method="POST" action="/route-pdf/facture" target="_blank" className="contents">
              <input type="hidden" name="payload" value={buildPayload(numeroFacture)} />
              <Button type="submit" disabled={!canSubmit}>
                <ReceiptText className="size-4" /> Générer la facture
              </Button>
            </form>
          </div>
        </div>
      </div>
    </Modal>
  );
}
