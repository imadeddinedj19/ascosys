-- ============================================================================
--  AscoSys 1.0 — Schéma initial (première ébauche)
--  À exécuter dans Supabase : SQL Editor → coller → Run.
--  Couvre : clients, formes (découpe), produits, tarification, ventes,
--  factures/BL, paiements, solde, caisse, salaires, congés.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  Profils utilisateurs (rôles) — liés à auth.users
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  role        text not null default 'commercial'
              check (role in ('admin', 'commercial', 'atelier')),
  created_at  timestamptz not null default now()
);

-- Crée automatiquement un profil à l'inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
--  Clients
-- ----------------------------------------------------------------------------
create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
  company_name  text not null,
  contact_person text,
  rc            text,   -- Registre de commerce
  nif           text,   -- Numéro d'identification fiscale
  art           text,   -- Article d'imposition
  nis           text,   -- Numéro d'identification statistique
  address       text,
  phone         text,
  email         text,
  industry_type text,
  notes         text,
  created_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
--  Formes de découpe (Lmoule) — référence par forme
-- ----------------------------------------------------------------------------
create table if not exists public.formes (
  id                uuid primary key default gen_random_uuid(),
  ref               text not null,
  fournisseur       text,
  longueur          numeric,
  largeur           numeric,
  hauteur           numeric,
  hauteur_couvercle numeric,
  longueur_forme    numeric,
  largeur_forme     numeric,
  nb_poses          numeric,
  storage_location  text,
  notes             text,
  created_at        timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
--  Produits
-- ----------------------------------------------------------------------------
create table if not exists public.products (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,           -- Désignation
  ref              text,                     -- Réf produit
  client_id        uuid references public.clients (id) on delete set null,
  forme_id         uuid references public.formes (id) on delete set null,
  dimensions       text,
  laize_utilisee   text,
  longueur         numeric,
  largeur          numeric,
  poids_par_feuille numeric,
  nombre_de_poses  numeric,
  trace            text,
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
--  Tarification (historisée)
-- ----------------------------------------------------------------------------
create table if not exists public.product_prices (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references public.products (id) on delete cascade,
  prix_unitaire    numeric not null,
  prix_palette     numeric,
  qte_par_palette  numeric,
  nombre_cartons   text,
  valid_from       date not null default current_date,
  created_at       timestamptz not null default now()
);
create index if not exists idx_product_prices_product on public.product_prices (product_id, valid_from desc);

-- ----------------------------------------------------------------------------
--  Compteur de numéros de documents (par année : 2026-0001, 2026-0002, …)
-- ----------------------------------------------------------------------------
create table if not exists public.document_counters (
  year  int primary key,
  last  int not null default 0
);

create or replace function public.next_document_numero()
returns text
language plpgsql
as $$
declare
  y int := extract(year from current_date);
  n int;
begin
  insert into public.document_counters (year, last)
  values (y, 1)
  on conflict (year) do update set last = public.document_counters.last + 1
  returning last into n;
  return y::text || '-' || lpad(n::text, 4, '0');
end;
$$;

-- ----------------------------------------------------------------------------
--  Ventes : documents (un document → Facture + Bon de Livraison)
-- ----------------------------------------------------------------------------
create table if not exists public.sales_documents (
  id          uuid primary key default gen_random_uuid(),
  numero      text unique not null default public.next_document_numero(),
  date        date not null default current_date,
  client_id   uuid not null references public.clients (id) on delete restrict,
  type        text not null default 'facture' check (type in ('bon', 'facture')),
  tva_rate    numeric not null default 0.19,
  total_ht    numeric not null default 0,
  total_tva   numeric not null default 0,
  total_ttc   numeric not null default 0,
  statut      text not null default 'brouillon'
              check (statut in ('brouillon', 'valide', 'paye')),
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_sales_documents_client on public.sales_documents (client_id);

create table if not exists public.sales_document_lines (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references public.sales_documents (id) on delete cascade,
  product_id    uuid references public.products (id) on delete set null,
  designation   text not null,
  quantite      numeric not null default 0,
  prix_unitaire numeric not null default 0,
  total_ht      numeric not null default 0,
  position      int not null default 0
);
create index if not exists idx_lines_document on public.sales_document_lines (document_id);

-- ----------------------------------------------------------------------------
--  Paiements (encaissements clients)
-- ----------------------------------------------------------------------------
create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  document_id uuid references public.sales_documents (id) on delete set null,
  date        date not null default current_date,
  montant     numeric not null,
  mode        text not null default 'espece' check (mode in ('cheque', 'espece', 'virement')),
  reference   text,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_payments_client on public.payments (client_id);

-- ----------------------------------------------------------------------------
--  Caisse
-- ----------------------------------------------------------------------------
create table if not exists public.caisse (
  id          uuid primary key default gen_random_uuid(),
  date        date not null default current_date,
  entree      numeric not null default 0,
  sortie      numeric not null default 0,
  observation text,
  action_par  text,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
--  Personnel & salaires
-- ----------------------------------------------------------------------------
create table if not exists public.employees (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  role            text,
  salaire_mensuel numeric not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create table if not exists public.salary_entries (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  date        date not null default current_date,
  type        text not null check (type in ('accrual', 'avance', 'paiement')),
  montant     numeric not null,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_salary_entries_emp on public.salary_entries (employee_id, date);

create table if not exists public.leaves (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  date        date not null default current_date,
  jours       numeric not null default 1,
  type        text,
  note        text,
  created_at  timestamptz not null default now()
);

-- ============================================================================
--  VUES
-- ============================================================================

-- Solde par client : total facturé − total encaissé
create or replace view public.client_balance as
select
  c.id                                             as client_id,
  c.company_name,
  coalesce(fact.total_facture, 0)                  as total_facture,
  coalesce(pay.total_paye, 0)                      as total_paye,
  coalesce(fact.total_facture, 0) - coalesce(pay.total_paye, 0) as solde
from public.clients c
left join (
  select client_id, sum(total_ttc) as total_facture
  from public.sales_documents
  where statut <> 'brouillon'
  group by client_id
) fact on fact.client_id = c.id
left join (
  select client_id, sum(montant) as total_paye
  from public.payments
  group by client_id
) pay on pay.client_id = c.id;

-- Solde courant de la caisse (cumul chronologique)
create or replace view public.caisse_running as
select
  id, date, entree, sortie, observation, action_par, created_at,
  sum(entree - sortie) over (order by date, created_at
    rows between unbounded preceding and current row) as solde
from public.caisse;

-- Situation salariale par employé : dû − (avances + paiements) = reste à payer
create or replace view public.employee_balance as
select
  e.id as employee_id,
  e.name,
  e.salaire_mensuel,
  coalesce(sum(se.montant) filter (where se.type = 'accrual'), 0)  as total_du,
  coalesce(sum(se.montant) filter (where se.type in ('avance', 'paiement')), 0) as total_verse,
  coalesce(sum(se.montant) filter (where se.type = 'accrual'), 0)
    - coalesce(sum(se.montant) filter (where se.type in ('avance', 'paiement')), 0) as reste_a_payer
from public.employees e
left join public.salary_entries se on se.employee_id = e.id
group by e.id, e.name, e.salaire_mensuel;

-- ============================================================================
--  RLS — v1 : tout utilisateur authentifié a accès complet (à affiner plus tard)
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','clients','formes','products','product_prices',
    'sales_documents','sales_document_lines','payments','caisse',
    'employees','salary_entries','leaves','document_counters'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format($p$
      drop policy if exists "authenticated_all" on public.%I;
      create policy "authenticated_all" on public.%I
        for all to authenticated using (true) with check (true);
    $p$, t, t);
  end loop;
end $$;
