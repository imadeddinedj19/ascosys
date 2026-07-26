"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, ArrowLeftRight, Sun, Moon, CalendarClock, GripVertical } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { formatNumber, formatDate } from "@/lib/format";
import type { OrderQueue, Client, Product, OrderShift, OrderStatut } from "@/lib/supabase/types";
import { saveOrder, deleteOrder, setOrderStatut, moveOrderShift, moveOrderPriority, reorderQueue, type OrderInput } from "./actions";

const STATUT: Record<OrderStatut, { label: string; variant: "default" | "success" | "warning" | "neutral" }> = {
  en_attente: { label: "En attente", variant: "warning" },
  en_cours: { label: "En cours", variant: "default" },
  termine: { label: "Terminé", variant: "success" },
  livre: { label: "Livré", variant: "neutral" },
};

const emptyForm = (shift: OrderShift): OrderInput => ({
  client_id: "", product_id: "", designation: "", quantite: "", laize_utilisee: "",
  date_prevue: "", shift, statut: "en_attente", notes: "",
});

export function CommandeEnInstanceView({
  orders: initialOrders, clients, products,
}: { orders: OrderQueue[]; clients: Client[]; products: Pick<Product, "id" | "name">[] }) {
  const [orders, setOrders] = useState(initialOrders);
  useEffect(() => setOrders(initialOrders), [initialOrders]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OrderQueue | null>(null);
  const [form, setForm] = useState<OrderInput>(emptyForm("matin"));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const dragId = useRef<string | null>(null);
  const [dropHint, setDropHint] = useState<string | null>(null); // id de la cible survolée (ou "col:matin")

  const clientName = useMemo(() => new Map(clients.map((c) => [c.id, c.company_name])), [clients]);
  const clientOptions = useMemo(() => clients.map((c) => ({ value: c.id, label: c.company_name })), [clients]);
  const productOptions = useMemo(() => products.map((p) => ({ value: p.id, label: p.name })), [products]);
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const byShift = (shift: OrderShift) => orders.filter((o) => o.shift === shift).sort((a, b) => a.priority - b.priority);

  function handleDrop(targetShift: OrderShift, targetIndex: number) {
    const id = dragId.current;
    dragId.current = null;
    setDropHint(null);
    if (!id) return;
    const dragged = orders.find((o) => o.id === id);
    if (!dragged) return;

    const target = orders.filter((o) => o.shift === targetShift && o.id !== id).sort((a, b) => a.priority - b.priority);
    const idx = Math.max(0, Math.min(targetIndex, target.length));
    target.splice(idx, 0, dragged);
    const updates = target.map((o, i) => ({ id: o.id, shift: targetShift, priority: i }));

    // Mise à jour optimiste locale.
    setOrders((prev) => prev.map((o) => {
      const u = updates.find((x) => x.id === o.id);
      return u ? { ...o, shift: u.shift, priority: u.priority } : o;
    }));
    start(async () => { const res = await reorderQueue(updates); if (!res.ok) alert(res.error); });
  }

  function set<K extends keyof OrderInput>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })); }
  function openNew(shift: OrderShift) { setEditing(null); setForm(emptyForm(shift)); setError(null); setOpen(true); }
  function openEdit(o: OrderQueue) {
    setEditing(o);
    setForm({
      client_id: o.client_id ?? "", product_id: o.product_id ?? "", designation: o.designation,
      quantite: String(o.quantite ?? ""), laize_utilisee: o.laize_utilisee ?? "", date_prevue: o.date_prevue ?? "",
      shift: o.shift, statut: o.statut, notes: o.notes ?? "",
    });
    setError(null); setOpen(true);
  }
  function pickProduct(v: string) {
    const p = productById.get(v);
    setForm((f) => ({ ...f, product_id: v, designation: p ? p.name : f.designation }));
  }
  function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    start(async () => { const res = await saveOrder(editing?.id ?? null, form); if (res.ok) setOpen(false); else setError(res.error); });
  }
  function remove(o: OrderQueue) {
    if (!confirm(`Supprimer la commande « ${o.designation} » ?`)) return;
    start(async () => { const res = await deleteOrder(o.id); if (!res.ok) alert(res.error); });
  }

  function Column({ shift, title, icon: Icon }: { shift: OrderShift; title: string; icon: typeof Sun }) {
    const list = byShift(shift);
    const colKey = `col:${shift}`;
    return (
      <div
        className={"flex-1 rounded-lg border p-3 transition-colors " + (dropHint === colKey ? "border-primary/60 bg-primary/5" : "border-border bg-surface/40")}
        onDragOver={(e) => { e.preventDefault(); setDropHint(colKey); }}
        onDrop={(e) => { e.preventDefault(); handleDrop(shift, list.length); }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Icon className="size-4 text-primary" /> {title} <span className="text-muted-foreground">({list.length})</span></h3>
          <Button variant="secondary" size="sm" onClick={() => openNew(shift)}><Plus className="size-3.5" /> Ajouter</Button>
        </div>
        <div className="space-y-2">
          {list.length === 0 ? (
            <p className="rounded-md border border-dashed border-border/60 py-8 text-center text-xs text-muted-foreground">Glissez une commande ici</p>
          ) : list.map((o, i) => (
            <div
              key={o.id}
              onDragOver={(e) => { e.preventDefault(); setDropHint(o.id); }}
              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDrop(shift, i); }}
              className={"rounded-md border bg-card/80 p-3 transition-colors " + (dropHint === o.id ? "border-primary" : "border-border")}
            >
              <div className="flex items-start gap-2">
                <span
                  draggable
                  onDragStart={(e) => { dragId.current = o.id; e.dataTransfer.effectAllowed = "move"; }}
                  onDragEnd={() => { dragId.current = null; setDropHint(null); }}
                  className="mt-0.5 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
                  aria-label="Déplacer"
                  title="Glisser pour déplacer"
                >
                  <GripVertical className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{o.designation}</p>
                      <p className="truncate text-xs text-muted">{o.client_id ? clientName.get(o.client_id) ?? "—" : "—"}</p>
                    </div>
                    <Badge variant={STATUT[o.statut].variant}>{STATUT[o.statut].label}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                    <span>Qté : <span className="text-foreground">{formatNumber(o.quantite, 0)}</span></span>
                    {o.laize_utilisee && <span>Laize : <span className="text-foreground">{o.laize_utilisee}</span></span>}
                    {o.date_prevue && <span className="inline-flex items-center gap-1"><CalendarClock className="size-3" /> {formatDate(o.date_prevue)}</span>}
                  </div>
                  <div className="mt-2 flex items-center gap-1 border-t border-border/60 pt-2">
                    <button type="button" onClick={() => start(async () => { await moveOrderPriority(o.id, "up"); })} disabled={i === 0 || pending} className="rounded p-1 text-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-30 cursor-pointer" aria-label="Monter"><ChevronUp className="size-4" /></button>
                    <button type="button" onClick={() => start(async () => { await moveOrderPriority(o.id, "down"); })} disabled={i === list.length - 1 || pending} className="rounded p-1 text-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-30 cursor-pointer" aria-label="Descendre"><ChevronDown className="size-4" /></button>
                    <button type="button" onClick={() => start(async () => { await moveOrderShift(o.id, shift === "matin" ? "soir" : "matin"); })} disabled={pending} className="rounded p-1 text-muted hover:bg-surface-2 hover:text-foreground cursor-pointer" aria-label="Changer de shift" title={shift === "matin" ? "Vers Soir" : "Vers Matin"}><ArrowLeftRight className="size-4" /></button>
                    <Select className="h-7 w-28 text-xs" value={o.statut} onChange={(e) => start(async () => { await setOrderStatut(o.id, e.target.value as OrderStatut); })}>
                      <option value="en_attente">En attente</option>
                      <option value="en_cours">En cours</option>
                      <option value="termine">Terminé</option>
                      <option value="livre">Livré</option>
                    </Select>
                    <div className="ml-auto flex gap-1">
                      <button type="button" onClick={() => openEdit(o)} className="rounded p-1 text-muted hover:bg-surface-2 hover:text-foreground cursor-pointer" aria-label="Modifier"><Pencil className="size-4" /></button>
                      <button type="button" onClick={() => remove(o)} className="rounded p-1 text-danger/80 hover:bg-surface-2 hover:text-danger cursor-pointer" aria-label="Supprimer"><Trash2 className="size-4" /></button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commande en instance"
        description="File d'attente de production — glissez les commandes (priorité) entre les shifts Matin / Soir"
        actions={<Button onClick={() => openNew("matin")}><Plus className="size-4" /> Nouvelle commande</Button>}
      />

      <div className="flex flex-col gap-4 lg:flex-row" onDragEnd={() => setDropHint(null)}>
        <Column shift="matin" title="Shift Matin" icon={Sun} />
        <Column shift="soir" title="Shift Soir" icon={Moon} />
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Modifier la commande" : "Nouvelle commande"} className="max-w-xl">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="client_id">Client</Label>
              <Combobox id="client_id" value={form.client_id ?? ""} onChange={(v) => set("client_id", v)} options={clientOptions} placeholder="— Aucun —" searchPlaceholder="Rechercher un client…" allowClear />
            </div>
            <div>
              <Label htmlFor="product_id">Produit</Label>
              <Combobox id="product_id" value={form.product_id ?? ""} onChange={pickProduct} options={productOptions} placeholder="— Libre —" searchPlaceholder="Rechercher un produit…" allowClear />
            </div>
            <div className="sm:col-span-2"><Label htmlFor="designation">Désignation *</Label><Input id="designation" value={form.designation} onChange={(e) => set("designation", e.target.value)} required /></div>
            <div><Label htmlFor="quantite">Quantité</Label><Input id="quantite" inputMode="decimal" value={form.quantite} onChange={(e) => set("quantite", e.target.value)} /></div>
            <div><Label htmlFor="laize_utilisee">Laize utilisée</Label><Input id="laize_utilisee" value={form.laize_utilisee ?? ""} onChange={(e) => set("laize_utilisee", e.target.value)} /></div>
            <div><Label htmlFor="date_prevue">Date prévue</Label><Input id="date_prevue" type="date" value={form.date_prevue ?? ""} onChange={(e) => set("date_prevue", e.target.value)} /></div>
            <div>
              <Label htmlFor="shift">Shift</Label>
              <Select id="shift" value={form.shift} onChange={(e) => set("shift", e.target.value)}>
                <option value="matin">Matin</option>
                <option value="soir">Soir</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="statut">Statut</Label>
              <Select id="statut" value={form.statut} onChange={(e) => set("statut", e.target.value)}>
                <option value="en_attente">En attente</option>
                <option value="en_cours">En cours</option>
                <option value="termine">Terminé</option>
                <option value="livre">Livré</option>
              </Select>
            </div>
            <div className="sm:col-span-2"><Label htmlFor="notes">Notes</Label><Textarea id="notes" rows={2} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></div>
          </div>
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
