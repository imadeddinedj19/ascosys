-- ============================================================================
--  AscoSys — Migration 0006 : Facture / BL de route (invoice fictive)
--  À exécuter UNE FOIS dans Supabase : SQL Editor → coller → Run.
--  Sûr à relancer (idempotent).
--
--  But : depuis un bon de livraison réel, générer une facture « de route »
--  affichée avec des prix réduits (par défaut −45 %) pour présentation aux
--  contrôles routiers / douanes. Elle consomme la numérotation facture
--  (les numéros restent continus) mais est exclue de la comptabilité réelle.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  1. Indicateur « fictif » + lien vers le bon de livraison parent
-- ----------------------------------------------------------------------------
alter table public.sales_documents
  add column if not exists fictive boolean not null default false;

alter table public.sales_documents
  add column if not exists parent_bon_id uuid
  references public.sales_documents (id) on delete set null;

create index if not exists idx_sales_documents_parent_bon
  on public.sales_documents (parent_bon_id);

create index if not exists idx_sales_documents_fictive
  on public.sales_documents (fictive)
  where fictive = true;

-- ----------------------------------------------------------------------------
--  2. Prix fictifs par client dans product_prices
--     Réutilise la table existante avec un drapeau « fictive » pour stocker
--     les prix personnalisés utilisés par défaut sur les factures de route.
-- ----------------------------------------------------------------------------
alter table public.product_prices
  add column if not exists fictive boolean not null default false;

create index if not exists idx_product_prices_fictive_lookup
  on public.product_prices (client_id, product_id)
  where fictive = true;

-- ----------------------------------------------------------------------------
--  3. Vue « solde client » : exclure aussi les documents fictifs
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
  where statut <> 'brouillon'
    and historique = false
    and fictive = false
  group by client_id
) fact on fact.client_id = c.id
left join (
  select client_id, sum(montant) as total_paye
  from public.payments
  group by client_id
) pay on pay.client_id = c.id;
