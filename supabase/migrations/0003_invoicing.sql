-- ============================================================================
--  AscoSys — Migration 0003 : Factures / Bons de livraison, types de client,
--  droit de timbre, numérotation dédiée.
--  À exécuter dans Supabase : SQL Editor → coller → Run. Idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  1. Type de client (entreprise / artisan / particulier) + carte d'artisan
-- ----------------------------------------------------------------------------
alter table public.clients
  add column if not exists client_type text not null default 'entreprise';
-- (contrainte posée séparément pour rester idempotent)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clients_client_type_chk') then
    alter table public.clients
      add constraint clients_client_type_chk
      check (client_type in ('entreprise', 'artisan', 'particulier'));
  end if;
end $$;

alter table public.clients
  add column if not exists carte_artisan text;

-- ----------------------------------------------------------------------------
--  2. Documents de vente : droit de timbre + mode de paiement (pour factures)
-- ----------------------------------------------------------------------------
alter table public.sales_documents
  add column if not exists timbre numeric not null default 0;
alter table public.sales_documents
  add column if not exists paiement_mode text; -- 'espece' | 'cheque' | 'virement' | null

-- ----------------------------------------------------------------------------
--  3. Compteurs de numérotation
--     Factures : N/YY (par année)          → 20/26
--     Bons     : N/MM/YY (par mois)        → 40/07/26
-- ----------------------------------------------------------------------------
create table if not exists public.facture_counters (
  year int primary key,
  last int not null default 0
);
create table if not exists public.bl_counters (
  year  int not null,
  month int not null,
  last  int not null default 0,
  primary key (year, month)
);

-- Prochain numéro de facture (incrémente + évite les collisions)
create or replace function public.next_facture_numero()
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  y int := extract(year from current_date);
  yy text := right(y::text, 2);
  n int;
  cand text;
begin
  insert into public.facture_counters (year, last) values (y, 1)
  on conflict (year) do update set last = public.facture_counters.last + 1
  returning last into n;
  cand := n::text || '/' || yy;
  while exists (select 1 from public.sales_documents where numero = cand) loop
    update public.facture_counters set last = last + 1 where year = y returning last into n;
    cand := n::text || '/' || yy;
  end loop;
  return cand;
end $$;

-- Prochain numéro de bon de livraison (par mois)
create or replace function public.next_bl_numero()
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  y int := extract(year from current_date);
  m int := extract(month from current_date);
  yy text := right(y::text, 2);
  mm text := lpad(m::text, 2, '0');
  n int;
  cand text;
begin
  insert into public.bl_counters (year, month, last) values (y, m, 1)
  on conflict (year, month) do update set last = public.bl_counters.last + 1
  returning last into n;
  cand := n::text || '/' || mm || '/' || yy;
  while exists (select 1 from public.sales_documents where numero = cand) loop
    update public.bl_counters set last = last + 1 where year = y and month = m returning last into n;
    cand := n::text || '/' || mm || '/' || yy;
  end loop;
  return cand;
end $$;

-- ----------------------------------------------------------------------------
--  4. RLS pour les nouvelles tables de compteurs
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['facture_counters', 'bl_counters']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format($p$
      drop policy if exists "authenticated_all" on public.%I;
      create policy "authenticated_all" on public.%I
        for all to authenticated using (true) with check (true);
    $p$, t, t);
  end loop;
end $$;
