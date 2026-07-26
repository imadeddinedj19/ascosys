"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Search, Phone } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Checkbox } from "@/components/ui/checkbox";
import { SelectionBar } from "@/components/ui/selection-bar";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
} from "@/components/ui/table";
import { useSelection } from "@/hooks/use-selection";
import { useTableControls, applyTableControls, HeaderMenu } from "@/components/ui/table-controls";
import type { Client } from "@/lib/supabase/types";
import { saveClient, deleteClient, deleteClients, type ClientInput } from "./actions";

const EMPTY: ClientInput = {
  company_name: "",
  contact_person: null,
  client_type: "entreprise",
  rc: null,
  carte_artisan: null,
  nif: null,
  art: null,
  nis: null,
  address: null,
  phone: null,
  email: null,
  industry_type: null,
  notes: null,
};

const TYPE_LABEL = { entreprise: "Entreprise", artisan: "Artisan", particulier: "Particulier" } as const;

export function ClientsView({ initialClients }: { initialClients: Client[] }) {
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return initialClients;
    return initialClients.filter((c) =>
      [c.company_name, c.contact_person, c.phone, c.nif, c.rc]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [initialClients, search]);

  const controls = useTableControls();
  const accessors = useMemo(() => ({
    name: (c: Client) => c.company_name,
    type: (c: Client) => TYPE_LABEL[c.client_type] ?? "Entreprise",
  }), []);
  const rows = useMemo(
    () => applyTableControls(filtered, accessors, controls.sort, controls.filters),
    [filtered, accessors, controls.sort, controls.filters],
  );
  const typeValues = useMemo(() => initialClients.map((c) => TYPE_LABEL[c.client_type] ?? "Entreprise"), [initialClients]);

  const sel = useSelection(rows.map((c) => c.id));

  function bulkDelete() {
    if (!confirm(`Supprimer ${sel.count} client(s) ? Cette action est irréversible.`)) return;
    startTransition(async () => {
      const res = await deleteClients(sel.selected);
      if (res.ok) sel.clear();
      else alert(res.error);
    });
  }

  function openNew() {
    setEditing(null);
    setForm(EMPTY);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(c: Client) {
    setEditing(c);
    setForm({ ...c });
    setError(null);
    setModalOpen(true);
  }

  function set<K extends keyof ClientInput>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await saveClient(editing?.id ?? null, form);
      if (res.ok) setModalOpen(false);
      else setError(res.error);
    });
  }

  function remove(c: Client) {
    if (!confirm(`Supprimer le client « ${c.company_name} » ?`)) return;
    startTransition(async () => {
      const res = await deleteClient(c.id);
      if (!res.ok) alert(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description={`${initialClients.length} client(s) enregistré(s)`}
        actions={
          <Button onClick={openNew}>
            <Plus className="size-4" /> Nouveau client
          </Button>
        }
      />

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Rechercher (nom, téléphone, NIF…)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-9"><Checkbox checked={sel.allChecked} indeterminate={sel.someChecked} onChange={sel.toggleAll} aria-label="Tout sélectionner" /></TableHead>
            <TableHead><HeaderMenu label="Raison sociale" colKey="name" controls={controls} /></TableHead>
            <TableHead><HeaderMenu label="Type" colKey="type" controls={controls} values={typeValues} /></TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Téléphone</TableHead>
            <TableHead>NIF</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableEmpty colSpan={7}>
              {search ? "Aucun client ne correspond à la recherche." : "Aucun client. Cliquez sur « Nouveau client »."}
            </TableEmpty>
          ) : (
            rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell><Checkbox checked={sel.isSelected(c.id)} onChange={() => sel.toggle(c.id)} aria-label="Sélectionner" /></TableCell>
                <TableCell className="font-medium text-foreground">{c.company_name}</TableCell>
                <TableCell><Badge variant="neutral">{TYPE_LABEL[c.client_type] ?? "Entreprise"}</Badge></TableCell>
                <TableCell className="text-muted">{c.contact_person ?? "—"}</TableCell>
                <TableCell className="text-muted">
                  {c.phone ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="size-3.5 text-muted-foreground" />
                      {c.phone}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted">{c.nif ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)} aria-label="Modifier">
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(c)}
                      aria-label="Supprimer"
                      className="text-danger hover:text-danger"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Modifier le client" : "Nouveau client"}
        className="max-w-2xl"
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="company_name">Raison sociale / Nom *</Label>
              <Input
                id="company_name"
                value={form.company_name}
                onChange={(e) => set("company_name", e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="client_type">Type de client</Label>
              <Select id="client_type" value={form.client_type} onChange={(e) => set("client_type", e.target.value)}>
                <option value="entreprise">Entreprise (Registre de commerce)</option>
                <option value="artisan">Artisan (Carte d&apos;artisan)</option>
                <option value="particulier">Particulier</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="contact_person">Personne de contact</Label>
              <Input id="contact_person" value={form.contact_person ?? ""} onChange={(e) => set("contact_person", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="phone">Téléphone</Label>
              <Input id="phone" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="industry_type">Secteur d&apos;activité</Label>
              <Input id="industry_type" value={form.industry_type ?? ""} onChange={(e) => set("industry_type", e.target.value)} />
            </div>
            {form.client_type === "entreprise" && (
              <div>
                <Label htmlFor="rc">RC (Registre de commerce)</Label>
                <Input id="rc" value={form.rc ?? ""} onChange={(e) => set("rc", e.target.value)} />
              </div>
            )}
            {form.client_type === "artisan" && (
              <div>
                <Label htmlFor="carte_artisan">Carte d&apos;artisan</Label>
                <Input id="carte_artisan" value={form.carte_artisan ?? ""} onChange={(e) => set("carte_artisan", e.target.value)} />
              </div>
            )}
            {form.client_type !== "particulier" && (
              <>
                <div>
                  <Label htmlFor="nif">NIF</Label>
                  <Input id="nif" value={form.nif ?? ""} onChange={(e) => set("nif", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="art">Article (ART)</Label>
                  <Input id="art" value={form.art ?? ""} onChange={(e) => set("art", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="nis">NIS</Label>
                  <Input id="nis" value={form.nis ?? ""} onChange={(e) => set("nis", e.target.value)} />
                </div>
              </>
            )}
            <div className="sm:col-span-2">
              <Label htmlFor="address">Adresse</Label>
              <Textarea id="address" rows={2} value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" rows={2} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
            </div>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </form>
      </Modal>

      <SelectionBar count={sel.count} noun="client" onClear={sel.clear} onDelete={bulkDelete} pending={pending} />
    </div>
  );
}
