/**
 * Configuration Supabase centralisée.
 * Tant que le projet Supabase n'est pas créé (variables d'environnement vides),
 * l'application fonctionne en « mode démo » : l'authentification est contournée
 * afin de pouvoir visualiser l'interface. Voir .env.example.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.startsWith("http") && SUPABASE_ANON_KEY.length > 20;
}
