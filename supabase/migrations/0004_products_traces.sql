-- ============================================================================
--  AscoSys — Migration 0004 : recentrage produit / découpe + stockage des Tracés
--  À exécuter dans Supabase : SQL Editor → coller → Run. Idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  1. Les caractéristiques techniques passent sur la DÉCOUPE (forme)
-- ----------------------------------------------------------------------------
alter table public.formes add column if not exists laize_utilisee    text;
alter table public.formes add column if not exists poids_par_feuille  numeric;

-- ----------------------------------------------------------------------------
--  2. Le PRODUIT ne garde que : désignation, référence, découpe, tracé (PDF)
--     (trace stocke désormais le chemin du fichier PDF dans le bucket "traces")
-- ----------------------------------------------------------------------------
alter table public.products drop column if exists dimensions;
alter table public.products drop column if exists laize_utilisee;
alter table public.products drop column if exists longueur;
alter table public.products drop column if exists largeur;
alter table public.products drop column if exists poids_par_feuille;
alter table public.products drop column if exists nombre_de_poses;
-- garde : name, ref, client_id, forme_id, trace (chemin PDF), active

-- ----------------------------------------------------------------------------
--  3. Bucket de stockage pour les Tracés (PDF fournis par le prestataire)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('traces', 'traces', true)
on conflict (id) do nothing;

-- Règles d'accès : lecture publique (bucket public) + écriture pour authentifiés.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'traces_public_read') then
    create policy "traces_public_read" on storage.objects
      for select to public using (bucket_id = 'traces');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'traces_auth_write') then
    create policy "traces_auth_write" on storage.objects
      for all to authenticated using (bucket_id = 'traces') with check (bucket_id = 'traces');
  end if;
end $$;
