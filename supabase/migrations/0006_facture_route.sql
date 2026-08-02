-- ============================================================================
--  AscoSys — Migration 0006 : Prix « facture / BL de route » par client
--  À exécuter UNE FOIS dans Supabase : SQL Editor → coller → Run.
--  Sûr à relancer (idempotent).
--
--  But : mémoriser les prix fictifs utilisés dans les factures / BL de route
--  générés à la volée (jamais persistés). Aucun impact sur les tables
--  existantes ; les documents fictifs eux-mêmes n'existent que le temps de
--  produire un PDF (aucune insertion dans sales_documents).
-- ============================================================================

create table if not exists public.fictive_prices (
  client_id      uuid not null references public.clients (id) on delete cascade,
  product_id     uuid not null references public.products (id) on delete cascade,
  prix_unitaire  numeric not null,
  updated_at     timestamptz not null default now(),
  primary key (client_id, product_id)
);

-- RLS : même règle que le reste du schéma → authentifié = accès complet.
alter table public.fictive_prices enable row level security;

drop policy if exists "authenticated_all" on public.fictive_prices;
create policy "authenticated_all" on public.fictive_prices
  for all to authenticated using (true) with check (true);
