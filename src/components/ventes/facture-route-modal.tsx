"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Percent, ReceiptText } from "lucide-react";
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
  createFactureRoute,
  getFictivePricesForClient,
  getSuggestedFactureNumero,
  type FactureRouteLineInput,
} from "@/app/(app)/ventes/actions";

export type BonLineForRoute = {
  id: string;
  product_id: string | null;
  designation: string;
  quantite: number;
  prix_reel: number;
};

type Row = FactureRouteLineInput;

const DEFAULT_DISCOUNT = 45.0;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function applyDiscount(prixReel: number, discountPct: number): number {
  const kept = 1 - discountPct / 100;
  return round1(prixReel * kept);
}

export function FactureRouteModal({
  open,
  onClose,
  bonId,
  clientId,
  bonLines,
  suggestedDate,
}: {
  open: boolean;
  onClose: () => void;
  bonId: string;
  clientId: string;
  bonLines: BonLineForRoute[];
  suggestedDate: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [numero, setNumero] = useState("");
  const [date, setDate] = useState(suggestedDate);
  const [tvaRate, setTvaRate] = useState("0.19");
  const [paiementMode, setPaiementMode] = useState<PaymentMode | "">("");
  const [discount, setDiscount] = useState(String(DEFAULT_DISCOUNT));
  const [savePrices, setSavePrices] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Réinitialise à chaque ouverture : numéro suggéré + prix fictifs enregistrés pour le client.
  useEffect(() => {
    if (!open) return;
    setLoaded(false);
    setError(null);
    setDate(suggestedDate);

    (async () => {
      const [saved, sugg] = await Promise.all([
        getFictivePricesForClient(clientId),
        getSuggestedFactureNumero(),
      ]);
      setNumero(sugg);
      const initial: Row[] = bonLines.map((l) => {
        const savedPrice = l.product_id ? saved[l.product_id] : undefined;
        const fictif =
          savedPrice != null && savedPrice > 0
            ? round1(savedPrice)
            : applyDiscount(l.prix_reel, DEFAULT_DISCOUNT);
        return {
          bon_line_id: l.id,
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

  const num = (v: string) => {
    const x = Number((v ?? "").replace(",", "."));
    return Number.isFinite(x) ? x : 0;
  };

  const totals = useMemo(() => {
    const ht = rows.reduce((s, r) => s + r.quantite * num(r.prix_fictif), 0);
    const tva = ht * num(tvaRate);
    const ttcBase = ht + tva;
    const timbre = droitTimbreSiEspeces(ttcBase, paiementMode || null);
    return { ht, tva, timbre, net: ttcBase + timbre };
  }, [rows, tvaRate, paiementMode]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await createFactureRoute(bonId, {
        numero: numero.trim(),
        date,
        tva_rate: tvaRate,
        paiement_mode: paiementMode,
        save_prices: savePrices,
        lines: rows,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
      // Ouvre la facture générée dans un nouvel onglet pour impression immédiate.
      window.open(`/ventes/${res.id}/facture`, "_blank");
      router.push(`/ventes/${res.id}`);
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Facture / BL de route" className="max-w-3xl">
      <form onSubmit={submit} className="space-y-5">
        <p className="text-xs text-muted-foreground">
          Génère une facture affichée à prix réduits (par défaut −{DEFAULT_DISCOUNT}%),
          liée au bon de livraison courant. Elle consomme la numérotation facture
          mais reste exclue du solde client réel.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="fr_numero">Numéro</Label>
            <Input id="fr_numero" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="24/26" />
          </div>
          <div>
            <Label htmlFor="fr_date">Date</Label>
            <Input id="fr_date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="fr_mode">Règlement</Label>
            <Select id="fr_mode" value={paiementMode} onChange={(e) => setPaiementMode(e.target.value as PaymentMode | "")}>
              <option value="">— Non réglé —</option>
              <option value="espece">Espèces (+ droit de timbre)</option>
              <option value="cheque">Chèque</option>
              <option value="virement">Virement</option>
            </Select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <Label htmlFor="fr_discount" className="flex items-center gap-1"><Percent className="size-3" /> Réduction (%)</Label>
            <Input
              id="fr_discount"
              inputMode="decimal"
              value={discount}
              onChange={(e) => applyGlobalDiscount(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">Recalcule tous les prix ci-dessous.</p>
          </div>
          <div className="sm:col-span-1">
            <Label htmlFor="fr_tva">TVA</Label>
            <Input id="fr_tva" inputMode="decimal" value={tvaRate} onChange={(e) => setTvaRate(e.target.value)} />
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
            <div className="px-3 py-4 text-sm text-muted-foreground">Aucune ligne à facturer.</div>
          ) : (
            rows.map((r, i) => (
              <div key={r.bon_line_id} className="grid grid-cols-12 gap-2 border-b border-border/60 px-3 py-2 last:border-0">
                <div className="col-span-5 truncate text-sm text-foreground">{r.designation}</div>
                <div className="col-span-2 text-right text-sm text-muted">{r.quantite}</div>
                <div className="col-span-2 text-right text-sm text-muted">{formatDZD(r.prix_reel)}</div>
                <div className="col-span-3">
                  <Input
                    inputMode="decimal"
                    className="text-right"
                    value={r.prix_fictif}
                    onChange={(e) => setRowPrice(i, e.target.value)}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="rounded-md bg-surface-2/40 px-3 py-2 text-sm">
          <div className="flex items-center justify-between"><span className="text-muted">Total HT</span><span className="font-medium">{formatDZD(totals.ht)}</span></div>
          <div className="flex items-center justify-between"><span className="text-muted">TVA</span><span className="font-medium">{formatDZD(totals.tva)}</span></div>
          {totals.timbre > 0 && (
            <div className="flex items-center justify-between"><span className="text-muted">Droit de timbre</span><span className="font-medium">{formatDZD(totals.timbre)}</span></div>
          )}
          <div className="mt-1 flex items-center justify-between border-t border-border pt-1 text-base">
            <span className="font-semibold">Net à payer</span><span className="font-semibold text-primary text-glow">{formatDZD(totals.net)}</span>
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={savePrices} onChange={setSavePrices} />
          <span className="text-muted-foreground">
            Enregistrer ces prix pour ce client (rappelés automatiquement au prochain BL).
          </span>
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button type="submit" disabled={pending || !loaded || rows.length === 0}>
            <ReceiptText className="size-4" /> {pending ? "Génération…" : "Générer + Imprimer"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
