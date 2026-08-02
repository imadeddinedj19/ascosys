"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Percent, ReceiptText, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDZD } from "@/lib/format";
import { droitTimbreSiEspeces } from "@/lib/fiscal";
import type { PaymentMode, SalesDocumentType } from "@/lib/supabase/types";
import {
  createRouteDocument,
  getFictivePricesForClient,
  getSuggestedNumero,
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
  const [busyDoc, setBusyDoc] = useState<SalesDocumentType | null>(null);

  // Numéros suggérés séparés pour chaque type (compteurs distincts).
  const [numeroFacture, setNumeroFacture] = useState("");
  const [numeroBon, setNumeroBon] = useState("");
  const [date, setDate] = useState(suggestedDate);
  const [tvaRate, setTvaRate] = useState("0.19");
  const [paiementMode, setPaiementMode] = useState<PaymentMode | "">("");
  const [discount, setDiscount] = useState(String(DEFAULT_DISCOUNT));
  const [savePrices, setSavePrices] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Ids des documents générés durant cette session (permet d'ouvrir le PDF sans repop-up).
  const [generated, setGenerated] = useState<{ facture?: string; bon?: string }>({});

  // Réinitialise à chaque ouverture : numéros suggérés + prix fictifs enregistrés pour le client.
  useEffect(() => {
    if (!open) return;
    setLoaded(false);
    setError(null);
    setGenerated({});
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

  function generate(docType: SalesDocumentType) {
    setError(null);
    setBusyDoc(docType);
    start(async () => {
      const res = await createRouteDocument(bonId, docType, {
        numero: (docType === "facture" ? numeroFacture : numeroBon).trim(),
        date,
        tva_rate: tvaRate,
        paiement_mode: paiementMode,
        save_prices: savePrices,
        lines: rows,
      });
      setBusyDoc(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setGenerated((g) => ({ ...g, [docType]: res.id }));
      router.refresh(); // rafraîchit la liste des factures / bons de l'onglet appelant
    });
  }

  function closeAndRefresh() {
    onClose();
    router.refresh();
  }

  return (
    <Modal open={open} onClose={closeAndRefresh} title="Facture / BL de route" className="max-w-3xl">
      <div className="space-y-5">
        <p className="text-xs text-muted-foreground">
          Génère des documents fictifs (prix réduits par défaut −{DEFAULT_DISCOUNT}%),
          liés au bon de livraison courant. Ils consomment leurs numérotations
          respectives mais restent exclus du solde client réel.
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
              <div key={r.bon_line_id} className="grid grid-cols-12 gap-2 border-b border-border/60 px-3 py-2 last:border-0">
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

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="outline" onClick={closeAndRefresh} disabled={pending}>
            Fermer
          </Button>
          <div className="flex flex-wrap gap-2">
            {/* BOUTON BL */}
            {generated.bon ? (
              <Link href={`/ventes/${generated.bon}/bon-livraison`} target="_blank" rel="noopener">
                <Button type="button" variant="secondary">
                  <ExternalLink className="size-4" /> Ouvrir le BL PDF
                </Button>
              </Link>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={() => generate("bon")}
                disabled={pending || !loaded || rows.length === 0}
              >
                <Truck className="size-4" />
                {busyDoc === "bon" ? "Génération…" : "Générer le bon de livraison"}
              </Button>
            )}

            {/* BOUTON FACTURE */}
            {generated.facture ? (
              <Link href={`/ventes/${generated.facture}/facture`} target="_blank" rel="noopener">
                <Button type="button">
                  <ExternalLink className="size-4" /> Ouvrir la facture PDF
                </Button>
              </Link>
            ) : (
              <Button
                type="button"
                onClick={() => generate("facture")}
                disabled={pending || !loaded || rows.length === 0}
              >
                <ReceiptText className="size-4" />
                {busyDoc === "facture" ? "Génération…" : "Générer la facture"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
