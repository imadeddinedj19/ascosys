"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ProspectStatus } from "@/lib/supabase/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type ProspectInput = {
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  industry_type: string | null;
  notes: string | null;
  status: ProspectStatus;
};

const t = (v: string | null) => (v && v.trim() ? v.trim() : null);

export async function saveProspect(id: string | null, input: ProspectInput): Promise<ActionResult> {
  if (!input.name?.trim()) return { ok: false, error: "Le nom du prospect est obligatoire." };
  const status: ProspectStatus =
    (["nouveau", "en_discussion", "gagne", "perdu"] as const).includes(input.status) ? input.status : "nouveau";
  const data = {
    name: input.name.trim(),
    contact_person: t(input.contact_person),
    phone: t(input.phone),
    email: t(input.email),
    industry_type: t(input.industry_type),
    notes: t(input.notes),
    status,
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("prospects").update(data).eq("id", id)
    : await supabase.from("prospects").insert(data);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/prospects");
  return { ok: true };
}

export async function deleteProspects(ids: string[]): Promise<ActionResult> {
  if (ids.length === 0) return { ok: true };
  const supabase = await createClient();
  const { error } = await supabase.from("prospects").delete().in("id", ids);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/prospects");
  return { ok: true };
}
