"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { OrderShift, OrderStatut } from "@/lib/supabase/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type OrderInput = {
  client_id: string | null;
  product_id: string | null;
  designation: string;
  quantite: string;
  laize_utilisee: string | null;
  date_prevue: string | null;
  shift: OrderShift;
  statut: OrderStatut;
  notes: string | null;
};

const numOrNull = (v: string): number => {
  const x = Number((v ?? "").trim().replace(",", "."));
  return Number.isFinite(x) ? x : 0;
};
const t = (v: string | null) => (v && v.trim() ? v.trim() : null);

export async function saveOrder(id: string | null, input: OrderInput): Promise<ActionResult> {
  if (!input.designation?.trim()) return { ok: false, error: "La désignation est obligatoire." };
  const supabase = await createClient();

  const base = {
    client_id: input.client_id || null,
    product_id: input.product_id || null,
    designation: input.designation.trim(),
    quantite: numOrNull(input.quantite),
    laize_utilisee: t(input.laize_utilisee),
    date_prevue: input.date_prevue || null,
    shift: input.shift,
    statut: input.statut,
    notes: t(input.notes),
  };

  if (id) {
    const { error } = await supabase.from("order_queue").update(base).eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    // Nouvelle commande → en bas de la file du shift choisi.
    const { data: last } = await supabase
      .from("order_queue")
      .select("priority")
      .eq("shift", input.shift)
      .order("priority", { ascending: false })
      .limit(1)
      .maybeSingle();
    const priority = (last?.priority ?? 0) + 1;
    const { error } = await supabase.from("order_queue").insert({ ...base, priority });
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/commande-en-instance");
  return { ok: true };
}

export async function deleteOrder(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("order_queue").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/commande-en-instance");
  return { ok: true };
}

export async function setOrderStatut(id: string, statut: OrderStatut): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("order_queue").update({ statut }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/commande-en-instance");
  return { ok: true };
}

/** Déplace une commande vers l'autre shift (en bas de la file cible). */
export async function moveOrderShift(id: string, shift: OrderShift): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("order_queue").select("priority").eq("shift", shift)
    .order("priority", { ascending: false }).limit(1).maybeSingle();
  const priority = (last?.priority ?? 0) + 1;
  const { error } = await supabase.from("order_queue").update({ shift, priority }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/commande-en-instance");
  return { ok: true };
}

/** Applique un nouvel ordre (glisser-déposer) : met à jour shift + priorité en lot. */
export async function reorderQueue(items: { id: string; shift: OrderShift; priority: number }[]): Promise<ActionResult> {
  if (items.length === 0) return { ok: true };
  const supabase = await createClient();
  for (const it of items) {
    const { error } = await supabase.from("order_queue").update({ shift: it.shift, priority: it.priority }).eq("id", it.id);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/commande-en-instance");
  return { ok: true };
}

/** Monte/descend une commande dans la file de son shift (échange de priorité). */
export async function moveOrderPriority(id: string, direction: "up" | "down"): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: current } = await supabase.from("order_queue").select("id, shift, priority").eq("id", id).single();
  if (!current) return { ok: false, error: "Commande introuvable." };

  const { data: siblings } = await supabase
    .from("order_queue").select("id, priority").eq("shift", current.shift)
    .order("priority", { ascending: true });
  const list = siblings ?? [];
  const idx = list.findIndex((o) => o.id === id);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= list.length) return { ok: true }; // déjà en bout de file

  const other = list[swapIdx];
  // Échange les priorités.
  await supabase.from("order_queue").update({ priority: other.priority }).eq("id", current.id);
  await supabase.from("order_queue").update({ priority: current.priority }).eq("id", other.id);
  revalidatePath("/commande-en-instance");
  return { ok: true };
}
