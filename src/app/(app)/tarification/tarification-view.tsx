"use client";

import { useMemo, useState, useTransition } from "react";
import { Search, Tag, History, Trash2, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty,
} from "@/components/ui/table";
import { formatDZD, formatDate, todayISO } from "@/lib/format";
import type { Product, ProductPrice, Client } from "@/lib/supabase/types";
import { savePrice, deletePrice, type PriceInput } from "./actions";

export function TarificationView({
  products, prices, clients,
}: { products: Product[]; prices: ProductPrice[]; clients: Client[] }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<PriceInput>({ prix_unitaire: "", client_id: "", valid_from: todayISO() });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const clientName = useMemo(() => new Map(clients.map((c) => [c.id, c.company_name])), [clients]);

  // Toutes les lignes de prix par produit (déjà triées valid_from desc côté serveur).
  const byProduct = useMemo(() => {
    const map = new Map<string, ProductPrice[]>();
    for (const p of prices) {
      (map.get(p.product_id) ?? map.set(p.product_id, []).get(p.product_id)!).push(p);
    }
    return map;
  }, [prices]);

  // Prix général courant + nombre de prix spécifiques courants, par produit.
  function currentGeneral(productId: string): ProductPrice | undefined {
    return byProduct.get(productId)?.find((p) => p.client_id == null);
  }
  function currentOverrides(productId: string): ProductPrice[] {
    const seen = new Set<string>();
    const out: ProductPrice[] = [];
    for (const p of byProduct.get(productId) ?? []) {
      if (p.client_id != null && !seen.has(p.client_id)) { seen.add(p.client_id); out.push(p); }
    }
    return out;
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || (p.ref ?? "").toLowerCase().includes(q));
  }, [products, search]);

  function openFor(p: Product) {
    setProduct(p);
    setForm({ prix_unitaire: currentGeneral(p.id) ? String(currentGeneral(p.id)!.prix_unitaire) : "", client_id: "", valid_from: todayISO() });
    setError(null);
    setOpen(true);
  }
  function set<K extends keyof PriceInput>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    if (!product) return;
    start(async () => {
      const res = await savePrice(product.id, form);
      if (res.ok) { setForm((f) => ({ ...f, prix_unitaire: "" })); }
      else setError(res.error);
    });
  }
  function removePrice(id: string) {
    if (!confirm("Supprimer cette ligne de prix ?")) return;
    start(async () => { const res = await deletePrice(id); if (!res.ok) alert(res.error); });
  }

  const history = product ? byProduct.get(product.id) ?? [] : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Tarification" description="Prix général et prix spécifiques par client (historisés)" />

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Rechercher un produit…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produit</TableHead>
            <TableHead className="text-right">Prix général</TableHead>
            <TableHead className="text-center">Prix clients</TableHead>
            <TableHead>Depuis</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableEmpty colSpan={5}>Aucun produit.</TableEmpty>
          ) : filtered.map((p) => {
            const cur = currentGeneral(p.id);
            const ov = currentOverrides(p.id);
            return (
              <TableRow key={p.id}>
                <TableCell className="font-medium text-foreground">{p.name}</TableCell>
                <TableCell className="text-right font-medium text-primary">{cur ? formatDZD(cur.prix_unitaire) : <span className="text-muted-foreground">non défini</span>}</TableCell>
                <TableCell className="text-center">{ov.length > 0 ? <Badge variant="default">{ov.length} client{ov.length > 1 ? "s" : ""}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-muted">{cur ? formatDate(cur.valid_from) : "—"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => openFor(p)}>
                    <Tag className="size-3.5" /> {cur || ov.length ? "Modifier" : "Définir"}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Modal open={open} onClose={() => setOpen(false)} title={product ? `Prix — ${product.name}` : "Prix"} className="max-w-xl">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="client_id">Applicable à</Label>
              <Combobox
                id="client_id"
                value={form.client_id ?? ""}
                onChange={(v) => set("client_id", v)}
                options={clients.map((c) => ({ value: c.id, label: `Prix spécifique — ${c.company_name}` }))}
                placeholder="Prix général (tous les clients)"
                searchPlaceholder="Rechercher un client…"
                allowClear
              />
            </div>
            <div><Label htmlFor="prix_unitaire">Prix unitaire (DA) *</Label><Input id="prix_unitaire" inputMode="decimal" value={form.prix_unitaire} onChange={(e) => set("prix_unitaire", e.target.value)} required autoFocus /></div>
            <div><Label htmlFor="valid_from">Applicable à partir du</Label><Input id="valid_from" type="date" value={form.valid_from} onChange={(e) => set("valid_from", e.target.value)} /></div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Fermer</Button>
            <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Ajouter ce prix"}</Button>
          </div>

          {history.length > 0 && (
            <div className="border-t border-border pt-3">
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <History className="size-3.5" /> Historique des prix
              </p>
              <ul className="space-y-1.5 text-sm">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-2 rounded-md bg-surface-2/40 px-3 py-1.5">
                    <span className="flex items-center gap-2 text-muted">
                      {formatDate(h.valid_from)}
                      {h.client_id ? (
                        <Badge variant="default"><Users className="size-3" /> {clientName.get(h.client_id) ?? "Client"}</Badge>
                      ) : (
                        <Badge variant="neutral">Général</Badge>
                      )}
                    </span>
                    <span className="ml-auto font-medium text-foreground">{formatDZD(h.prix_unitaire)}</span>
                    <button type="button" onClick={() => removePrice(h.id)} className="text-danger/70 hover:text-danger cursor-pointer" aria-label="Supprimer">
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
