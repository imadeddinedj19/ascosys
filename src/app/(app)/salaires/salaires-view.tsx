"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Wallet, CalendarDays, CircleDollarSign } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty,
} from "@/components/ui/table";
import { formatDZD, formatDate, formatNumber, todayISO } from "@/lib/format";
import type { Employee, EmployeeBalance, SalaryEntry, Leave, SalaryEntryType } from "@/lib/supabase/types";
import {
  saveEmployee, deleteEmployee, addSalaryEntry, deleteSalaryEntry, addLeave, deleteLeave,
  type EmployeeInput, type SalaryEntryInput, type LeaveInput,
} from "./actions";

const ENTRY_LABEL: Record<SalaryEntryType, string> = { accrual: "Salaire dû", avance: "Avance", paiement: "Paiement" };
const EMPTY_EMP: EmployeeInput = { name: "", role: "", salaire_mensuel: "", active: true };

export function SalairesView({
  employees, balances, entries, leaves,
}: { employees: Employee[]; balances: EmployeeBalance[]; entries: SalaryEntry[]; leaves: Leave[] }) {
  const [pending, start] = useTransition();

  const [empOpen, setEmpOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [empForm, setEmpForm] = useState<EmployeeInput>(EMPTY_EMP);
  const [empError, setEmpError] = useState<string | null>(null);

  const [detailsFor, setDetailsFor] = useState<Employee | null>(null);
  const [entryForm, setEntryForm] = useState<SalaryEntryInput>({ type: "avance", montant: "", date: todayISO(), note: "" });
  const [leaveForm, setLeaveForm] = useState<LeaveInput>({ date: todayISO(), jours: "1", type: "", note: "" });
  const [detailError, setDetailError] = useState<string | null>(null);

  const balanceById = useMemo(() => new Map(balances.map((b) => [b.employee_id, b])), [balances]);
  const entriesByEmp = useMemo(() => {
    const m = new Map<string, SalaryEntry[]>();
    for (const e of entries) (m.get(e.employee_id) ?? m.set(e.employee_id, []).get(e.employee_id)!).push(e);
    return m;
  }, [entries]);
  const leavesByEmp = useMemo(() => {
    const m = new Map<string, Leave[]>();
    for (const l of leaves) (m.get(l.employee_id) ?? m.set(l.employee_id, []).get(l.employee_id)!).push(l);
    return m;
  }, [leaves]);

  const totalReste = useMemo(() => balances.reduce((s, b) => s + Number(b.reste_a_payer), 0), [balances]);

  /* Employé */
  function openNewEmp() { setEditing(null); setEmpForm(EMPTY_EMP); setEmpError(null); setEmpOpen(true); }
  function openEditEmp(e: Employee) {
    setEditing(e);
    setEmpForm({ name: e.name, role: e.role ?? "", salaire_mensuel: String(e.salaire_mensuel), active: e.active });
    setEmpError(null); setEmpOpen(true);
  }
  function submitEmp(ev: React.FormEvent) {
    ev.preventDefault(); setEmpError(null);
    start(async () => { const r = await saveEmployee(editing?.id ?? null, empForm); if (r.ok) setEmpOpen(false); else setEmpError(r.error); });
  }
  function removeEmp(e: Employee) {
    if (!confirm(`Supprimer l'employé « ${e.name} » et tout son historique ?`)) return;
    start(async () => { const r = await deleteEmployee(e.id); if (!r.ok) alert(r.error); });
  }

  /* Détails : écritures & congés */
  function openDetails(e: Employee) {
    setDetailsFor(e);
    setEntryForm({ type: "avance", montant: "", date: todayISO(), note: "" });
    setLeaveForm({ date: todayISO(), jours: "1", type: "", note: "" });
    setDetailError(null);
  }
  function addSalaireMois() {
    if (!detailsFor) return;
    setDetailError(null);
    start(async () => {
      const r = await addSalaryEntry(detailsFor.id, {
        type: "accrual", montant: String(detailsFor.salaire_mensuel), date: todayISO(),
        note: "Salaire mensuel",
      });
      if (!r.ok) setDetailError(r.error);
    });
  }
  function submitEntry(ev: React.FormEvent) {
    ev.preventDefault(); setDetailError(null);
    if (!detailsFor) return;
    start(async () => {
      const r = await addSalaryEntry(detailsFor.id, entryForm);
      if (r.ok) setEntryForm({ type: "avance", montant: "", date: todayISO(), note: "" });
      else setDetailError(r.error);
    });
  }
  function submitLeave(ev: React.FormEvent) {
    ev.preventDefault(); setDetailError(null);
    if (!detailsFor) return;
    start(async () => {
      const r = await addLeave(detailsFor.id, leaveForm);
      if (r.ok) setLeaveForm({ date: todayISO(), jours: "1", type: "", note: "" });
      else setDetailError(r.error);
    });
  }

  const detailEntries = detailsFor ? entriesByEmp.get(detailsFor.id) ?? [] : [];
  const detailLeaves = detailsFor ? leavesByEmp.get(detailsFor.id) ?? [] : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Salaires"
        description={`${employees.length} employé(s) · Reste à payer total : ${formatDZD(totalReste)}`}
        actions={<Button onClick={openNewEmp}><Plus className="size-4" /> Nouvel employé</Button>}
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employé</TableHead>
            <TableHead>Poste</TableHead>
            <TableHead className="text-right">Salaire mensuel</TableHead>
            <TableHead className="text-right">Cumul dû</TableHead>
            <TableHead className="text-right">Versé</TableHead>
            <TableHead className="text-right">Reste à payer</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.length === 0 ? (
            <TableEmpty colSpan={7}>Aucun employé. Cliquez sur « Nouvel employé ».</TableEmpty>
          ) : employees.map((e) => {
            const b = balanceById.get(e.id);
            const reste = b ? Number(b.reste_a_payer) : 0;
            return (
              <TableRow key={e.id}>
                <TableCell className="font-medium text-foreground">
                  {e.name} {!e.active && <Badge variant="neutral" className="ml-2">Inactif</Badge>}
                </TableCell>
                <TableCell className="text-muted">{e.role ?? "—"}</TableCell>
                <TableCell className="text-right text-muted">{formatDZD(e.salaire_mensuel)}</TableCell>
                <TableCell className="text-right text-muted">{formatDZD(b?.total_du ?? 0)}</TableCell>
                <TableCell className="text-right text-muted">{formatDZD(b?.total_verse ?? 0)}</TableCell>
                <TableCell className="text-right font-medium"><span className={reste > 0 ? "text-warning" : "text-success"}>{formatDZD(reste)}</span></TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="outline" size="sm" onClick={() => openDetails(e)}><Wallet className="size-3.5" /> Gérer</Button>
                    <Button variant="ghost" size="icon" onClick={() => openEditEmp(e)} aria-label="Modifier"><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => removeEmp(e)} aria-label="Supprimer" className="text-danger hover:text-danger"><Trash2 className="size-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Modal employé */}
      <Modal open={empOpen} onClose={() => setEmpOpen(false)} title={editing ? "Modifier l'employé" : "Nouvel employé"}>
        <form onSubmit={submitEmp} className="space-y-4">
          <div><Label htmlFor="name">Nom complet *</Label><Input id="name" value={empForm.name} onChange={(e) => setEmpForm((f) => ({ ...f, name: e.target.value }))} required autoFocus /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="role">Poste</Label><Input id="role" value={empForm.role ?? ""} onChange={(e) => setEmpForm((f) => ({ ...f, role: e.target.value }))} /></div>
            <div><Label htmlFor="salaire_mensuel">Salaire mensuel (DA)</Label><Input id="salaire_mensuel" inputMode="decimal" value={empForm.salaire_mensuel} onChange={(e) => setEmpForm((f) => ({ ...f, salaire_mensuel: e.target.value }))} /></div>
          </div>
          <div className="flex items-center gap-2">
            <input id="active" type="checkbox" checked={empForm.active} onChange={(e) => setEmpForm((f) => ({ ...f, active: e.target.checked }))} className="size-4 accent-[var(--primary)]" />
            <Label htmlFor="active" className="mb-0">Employé actif</Label>
          </div>
          {empError && <p className="text-sm text-danger">{empError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEmpOpen(false)}>Annuler</Button>
            <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>
          </div>
        </form>
      </Modal>

      {/* Modal détails (salaire + congés) */}
      <Modal open={detailsFor !== null} onClose={() => setDetailsFor(null)} title={detailsFor ? `Salaire — ${detailsFor.name}` : ""} className="max-w-2xl">
        {detailsFor && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={addSalaireMois} disabled={pending}>
                <CircleDollarSign className="size-4" /> Comptabiliser le salaire du mois ({formatDZD(detailsFor.salaire_mensuel)})
              </Button>
            </div>

            {/* Ajouter une écriture */}
            <form onSubmit={submitEntry} className="grid gap-2 rounded-md border border-border/60 p-3 sm:grid-cols-5">
              <Select value={entryForm.type} onChange={(e) => setEntryForm((f) => ({ ...f, type: e.target.value as SalaryEntryType }))}>
                <option value="avance">Avance</option>
                <option value="paiement">Paiement</option>
                <option value="accrual">Salaire dû</option>
              </Select>
              <Input inputMode="decimal" placeholder="Montant" value={entryForm.montant} onChange={(e) => setEntryForm((f) => ({ ...f, montant: e.target.value }))} />
              <Input type="date" value={entryForm.date} onChange={(e) => setEntryForm((f) => ({ ...f, date: e.target.value }))} />
              <Input placeholder="Note" value={entryForm.note ?? ""} onChange={(e) => setEntryForm((f) => ({ ...f, note: e.target.value }))} />
              <Button type="submit" size="sm" disabled={pending}><Plus className="size-4" /> Ajouter</Button>
            </form>

            {/* Historique écritures */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Historique des salaires / avances</p>
              {detailEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune écriture.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {detailEntries.map((en) => (
                    <li key={en.id} className="flex items-center justify-between rounded-md bg-surface-2/40 px-3 py-1.5">
                      <span className="flex items-center gap-2">
                        <Badge variant={en.type === "accrual" ? "warning" : "success"}>{ENTRY_LABEL[en.type]}</Badge>
                        <span className="text-muted">{formatDate(en.date)}</span>
                        {en.note && <span className="text-muted-foreground">· {en.note}</span>}
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="font-medium text-foreground">{formatDZD(en.montant)}</span>
                        <button type="button" onClick={() => start(async () => { const r = await deleteSalaryEntry(en.id); if (!r.ok) alert(r.error); })} className="text-danger/70 hover:text-danger cursor-pointer" aria-label="Supprimer"><Trash2 className="size-3.5" /></button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Congés */}
            <div className="border-t border-border pt-4">
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <CalendarDays className="size-3.5" /> Congés
              </p>
              <form onSubmit={submitLeave} className="grid gap-2 rounded-md border border-border/60 p-3 sm:grid-cols-5">
                <Input type="date" value={leaveForm.date} onChange={(e) => setLeaveForm((f) => ({ ...f, date: e.target.value }))} />
                <Input inputMode="decimal" placeholder="Jours" value={leaveForm.jours} onChange={(e) => setLeaveForm((f) => ({ ...f, jours: e.target.value }))} />
                <Input placeholder="Motif (aïd, maladie…)" className="sm:col-span-2" value={leaveForm.type ?? ""} onChange={(e) => setLeaveForm((f) => ({ ...f, type: e.target.value }))} />
                <Button type="submit" size="sm" disabled={pending}><Plus className="size-4" /> Ajouter</Button>
              </form>
              {detailLeaves.length > 0 && (
                <ul className="mt-2 space-y-1.5 text-sm">
                  {detailLeaves.map((lv) => (
                    <li key={lv.id} className="flex items-center justify-between rounded-md bg-surface-2/40 px-3 py-1.5">
                      <span className="text-muted">{formatDate(lv.date)} · {formatNumber(lv.jours, 0)} jour(s){lv.type ? ` · ${lv.type}` : ""}</span>
                      <button type="button" onClick={() => start(async () => { const r = await deleteLeave(lv.id); if (!r.ok) alert(r.error); })} className="text-danger/70 hover:text-danger cursor-pointer" aria-label="Supprimer"><Trash2 className="size-3.5" /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {detailError && <p className="text-sm text-danger">{detailError}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
