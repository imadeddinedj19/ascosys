-- ============================================================================
--  AscoSys — Migration 0002 : Trésorerie, solde d'ouverture, prix par client
--  À exécuter UNE FOIS dans Supabase : SQL Editor → coller → Run.
--  Sûr à relancer (idempotent).
-- ============================================================================

-- ----------------------------------------------------------------------------
--  1. Catégories de transactions (labels modifiables depuis les Paramètres)
-- ----------------------------------------------------------------------------
create table if not exists public.transaction_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  direction  text not null default 'out' check (direction in ('in', 'out', 'both')),
  color      text not null default '#22d3ee',
  sort_order int  not null default 0,
  active     boolean not null default true,
  is_system  boolean not null default false,
  created_at timestamptz not null default now()
);

-- Catégories par défaut (l'utilisateur pourra les renommer / désactiver)
insert into public.transaction_categories (name, direction, color, sort_order, is_system) values
  ('Salaire',                     'out', '#f59e0b', 10, true),
  ('Achat matière / fournisseur', 'out', '#a78bfa', 20, true),
  ('Dépense générale',            'out', '#f87171', 30, true),
  ('Loyer & charges',             'out', '#fb7185', 40, true),
  ('Investissement',              'out', '#34d399', 50, true),
  ('Entrée diverse',              'in',  '#22d3ee', 60, true),
  ('Sortie diverse',              'out', '#94a3b8', 70, true)
on conflict (name) do nothing;

-- ----------------------------------------------------------------------------
--  2. Transactions (trésorerie générale : dépenses, salaires, fournisseurs…)
-- ----------------------------------------------------------------------------
create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  date        date not null default current_date,
  direction   text not null default 'out' check (direction in ('in', 'out')),
  montant     numeric not null,
  category_id uuid references public.transaction_categories (id) on delete set null,
  tiers       text,          -- fournisseur / bénéficiaire / tiers concerné
  reference   text,
  description text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_transactions_date on public.transactions (date desc);
create index if not exists idx_transactions_cat  on public.transactions (category_id);

-- Reprise des anciennes lignes de Caisse dans le nouveau registre (une seule fois)
insert into public.transactions (date, direction, montant, tiers, description, created_at)
select c.date,
       case when coalesce(c.entree,0) >= coalesce(c.sortie,0) then 'in' else 'out' end,
       abs(coalesce(c.entree,0) - coalesce(c.sortie,0)),
       c.action_par,
       c.observation,
       c.created_at
from public.caisse c
where not exists (select 1 from public.transactions t where t.created_at = c.created_at and t.montant = abs(coalesce(c.entree,0) - coalesce(c.sortie,0)))
  and abs(coalesce(c.entree,0) - coalesce(c.sortie,0)) > 0;

-- ----------------------------------------------------------------------------
--  3. Solde d'ouverture par client (dette réelle au démarrage du CRM)
-- ----------------------------------------------------------------------------
alter table public.clients
  add column if not exists solde_ouverture numeric not null default 0;

-- ----------------------------------------------------------------------------
--  4. Marquer l'historique importé (exclu du calcul de la dette courante,
--     mais conservé dans la liste des ventes et le tableau de bord)
-- ----------------------------------------------------------------------------
alter table public.sales_documents
  add column if not exists historique boolean not null default false;

update public.sales_documents
  set historique = true
  where notes like '%[IMPORT-VENTES%' and historique = false;

-- ----------------------------------------------------------------------------
--  5. Prix par client + suppression de la tarification par palette
-- ----------------------------------------------------------------------------
alter table public.product_prices
  add column if not exists client_id uuid references public.clients (id) on delete cascade;
create index if not exists idx_product_prices_client on public.product_prices (client_id);

alter table public.product_prices drop column if exists prix_palette;
alter table public.product_prices drop column if exists qte_par_palette;
alter table public.product_prices drop column if exists nombre_cartons;

-- ----------------------------------------------------------------------------
--  6. Vue « solde client » : solde d'ouverture + facturé (hors historique) − payé
-- ----------------------------------------------------------------------------
drop view if exists public.client_balance;
create view public.client_balance as
select
  c.id                              as client_id,
  c.company_name,
  coalesce(c.solde_ouverture, 0)    as solde_ouverture,
  coalesce(fact.total_facture, 0)   as total_facture,
  coalesce(pay.total_paye, 0)       as total_paye,
  coalesce(c.solde_ouverture, 0)
    + coalesce(fact.total_facture, 0)
    - coalesce(pay.total_paye, 0)   as solde
from public.clients c
left join (
  select client_id, sum(total_ttc) as total_facture
  from public.sales_documents
  where statut <> 'brouillon' and historique = false
  group by client_id
) fact on fact.client_id = c.id
left join (
  select client_id, sum(montant) as total_paye
  from public.payments
  group by client_id
) pay on pay.client_id = c.id;

-- ----------------------------------------------------------------------------
--  7. Vue « trésorerie cumulée » (solde courant du registre)
-- ----------------------------------------------------------------------------
create or replace view public.transactions_running as
select
  t.id, t.date, t.direction, t.montant, t.category_id, t.tiers, t.reference,
  t.description, t.created_at,
  sum(case when t.direction = 'in' then t.montant else -t.montant end)
    over (order by t.date, t.created_at rows between unbounded preceding and current row) as solde
from public.transactions t;

-- ----------------------------------------------------------------------------
--  8. RLS pour les nouvelles tables (même règle que le reste : authentifié = accès)
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['transaction_categories', 'transactions']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format($p$
      drop policy if exists "authenticated_all" on public.%I;
      create policy "authenticated_all" on public.%I
        for all to authenticated using (true) with check (true);
    $p$, t, t);
  end loop;
end $$;
