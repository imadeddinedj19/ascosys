"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SalaryEntryType } from "@/lib/supabase/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

const n = (v: string): number => {
  const x = Number((v ?? "").trim().replace(",", "."));
  return Number.isFinite(x) ? x : 0;
};

/* ---------- Employés ---------- */
export type EmployeeInput = {
  name: string;
  role: string | null;
  salaire_mensuel: string;
  active: boolean;
};

export async function saveEmployee(id: string | null, input: EmployeeInput): Promise<ActionResult> {
  if (!input.name?.trim()) return { ok: false, error: "Le nom est obligatoire." };
  const data = {
    name: input.name.trim(),
    role: input.role?.trim() || null,
    salaire_mensuel: n(input.salaire_mensuel),
    active: input.active,
  };
  const supabase = await createClient();
  const query = id
    ? supabase.from("employees").update(data).eq("id", id)
    : supabase.from("employees").insert(data);
  const { error } = await query;
  if (error) return { ok: false, error: error.message };
  revalidatePath("/salaires");
  return { ok: true };
}

export async function deleteEmployee(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("employees").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/salaires");
  return { ok: true };
}

/* ---------- Écritures de salaire ---------- */
export type SalaryEntryInput = {
  type: SalaryEntryType;
  montant: string;
  date: string;
  note: string | null;
};

export async function addSalaryEntry(employeeId: string, input: SalaryEntryInput): Promise<ActionResult> {
  const montant = n(input.montant);
  if (montant <= 0) return { ok: false, error: "Le montant doit être supérieur à 0." };
  const supabase = await createClient();
  const { error } = await supabase.from("salary_entries").insert({
    employee_id: employeeId,
    type: input.type,
    montant,
    date: input.date,
    note: input.note?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/salaires");
  return { ok: true };
}

export async function deleteSalaryEntry(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("salary_entries").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/salaires");
  return { ok: true };
}

/* ---------- Congés ---------- */
export type LeaveInput = {
  date: string;
  jours: string;
  type: string | null;
  note: string | null;
};

export async function addLeave(employeeId: string, input: LeaveInput): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("leaves").insert({
    employee_id: employeeId,
    date: input.date,
    jours: n(input.jours) || 1,
    type: input.type?.trim() || null,
    note: input.note?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/salaires");
  return { ok: true };
}

export async function deleteLeave(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("leaves").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/salaires");
  return { ok: true };
}
