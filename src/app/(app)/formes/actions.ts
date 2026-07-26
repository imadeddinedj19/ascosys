"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type FormeInput = {
  ref: string;
  fournisseur: string | null;
  longueur: string;
  largeur: string;
  hauteur: string;
  hauteur_couvercle: string;
  longueur_forme: string;
  largeur_forme: string;
  nb_poses: string;
  laize_utilisee: string | null;
  poids_par_feuille: string;
  storage_location: string | null;
  notes: string | null;
};

const n = (v: string): number | null => {
  const t = (v ?? "").trim().replace(",", ".");
  if (t === "") return null;
  const x = Number(t);
  return Number.isFinite(x) ? x : null;
};
const t = (v: string | null) => (v && v.trim() ? v.trim() : null);

export async function saveForme(id: string | null, input: FormeInput): Promise<ActionResult> {
  if (!input.ref?.trim()) return { ok: false, error: "La référence est obligatoire." };
  const data = {
    ref: input.ref.trim(),
    fournisseur: t(input.fournisseur),
    longueur: n(input.longueur),
    largeur: n(input.largeur),
    hauteur: n(input.hauteur),
    hauteur_couvercle: n(input.hauteur_couvercle),
    longueur_forme: n(input.longueur_forme),
    largeur_forme: n(input.largeur_forme),
    nb_poses: n(input.nb_poses),
    laize_utilisee: t(input.laize_utilisee),
    poids_par_feuille: n(input.poids_par_feuille),
    storage_location: t(input.storage_location),
    notes: t(input.notes),
  };
  const supabase = await createClient();
  const query = id
    ? supabase.from("formes").update(data).eq("id", id)
    : supabase.from("formes").insert(data);
  const { error } = await query;
  if (error) return { ok: false, error: error.message };
  revalidatePath("/formes");
  return { ok: true };
}

export async function deleteForme(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("formes").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/formes");
  return { ok: true };
}
