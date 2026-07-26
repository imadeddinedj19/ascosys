-- ============================================================================
--  AscoSys — Migration 0005 : Prospects, Devis/Proforma, Commande en instance,
--  Bon de versement (dépôts prospects). À exécuter dans Supabase SQL Editor.
--  Idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  1. Prospects (leads — pas encore dans la base clients)
-- ----------------------------------------------------------------------------
create table if not exists public.prospects (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  contact_person text,
  phone         text,
  email         text,
  industry_type text,
  notes         text,
  status        text not null default 'nouveau'
                check (status in ('nouveau', 'en_discussion', 'gagne', 'perdu')),
  client_id     uuid references public.clients (id) on delete set null, -- rempli à la conversion
  created_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
--  2. Numérotation des devis : N/YY (compteur annuel dédié)
-- ----------------------------------------------------------------------------
create table if not exists public.proforma_counters (
  year int primary key,
  last int not null default 0
);

create or replace function public.next_proforma_numero()
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
  insert into public.proforma_counters (year, last) values (y, 1)
  on conflict (year) do update set last = public.proforma_counters.last + 1
  returning last into n;
  cand := n::text || '/' || yy;
  while exists (select 1 from public.proformas where numero = cand) loop
    update public.proforma_counters set last = last + 1 where year = y returning last into n;
    cand := n::text || '/' || yy;
  end loop;
  return cand;
end $$;

-- ----------------------------------------------------------------------------
--  3. Devis / Proforma
-- ----------------------------------------------------------------------------
create table if not exists public.proformas (
  id          uuid primary key default gen_random_uuid(),
  numero      text unique not null default public.next_proforma_numero(),
  prospect_id uuid references public.prospects (id) on delete cascade,
  client_id   uuid references public.clients (id) on delete set null,
  date        date not null default current_date,
  tva_rate    numeric not null default 0.19,
  total_ht    numeric not null default 0,
  total_tva   numeric not null default 0,
  total_ttc   numeric not null default 0,
  statut      text not null default 'brouillon'
              check (statut in ('brouillon', 'envoye', 'valide', 'refuse')),
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_proformas_prospect on public.proformas (prospect_id);

create table if not exists public.proforma_lines (
  id            uuid primary key default gen_random_uuid(),
  proforma_id   uuid not null references public.proformas (id) on delete cascade,
  product_id    uuid references public.products (id) on delete set null,
  designation   text not null,
  quantite      numeric not null default 0,
  prix_unitaire numeric not null default 0,
  total_ht      numeric not null default 0,
  position      int not null default 0
);
create index if not exists idx_proforma_lines_doc on public.proforma_lines (proforma_id);

-- ----------------------------------------------------------------------------
--  4. Dépôts / versements des prospects (avant conversion en client)
-- ----------------------------------------------------------------------------
create table if not exists public.prospect_deposits (
  id          uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects (id) on delete cascade,
  proforma_id uuid references public.proformas (id) on delete set null,
  date        date not null default current_date,
  montant     numeric not null,
  mode        text not null default 'espece' check (mode in ('cheque', 'espece', 'virement')),
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_prospect_deposits_prospect on public.prospect_deposits (prospect_id);

-- ----------------------------------------------------------------------------
--  5. Commande en instance (file d'attente de production)
-- ----------------------------------------------------------------------------
create table if not exists public.order_queue (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid references public.clients (id) on delete set null,
  product_id     uuid references public.products (id) on delete set null,
  designation    text not null,
  quantite       numeric not null default 0,
  laize_utilisee text,
  date_prevue    date,
  shift          text not null default 'matin' check (shift in ('matin', 'soir')),
  priority       int not null default 0,
  statut         text not null default 'en_attente'
                 check (statut in ('en_attente', 'en_cours', 'termine', 'livre')),
  proforma_id    uuid references public.proformas (id) on delete set null,
  notes          text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_order_queue_shift on public.order_queue (shift, priority);

-- ----------------------------------------------------------------------------
--  6. RLS pour les nouvelles tables
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'prospects', 'proforma_counters', 'proformas', 'proforma_lines',
    'prospect_deposits', 'order_queue'
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
