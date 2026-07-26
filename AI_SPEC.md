# AscoSys 1.0 — Complete AI Rebuild Specification

> This document is a self-contained specification. An AI reading this file should be able to rebuild the entire AscoSys application from scratch without any other context. It covers every architectural decision, module, database schema, UI pattern, business rule, and edge case.

---

## 1. Business Context

**Client:** EURL ASCO TRADING (ASCO Trading Group — ATG), a B2B custom-packaging manufacturer in Douera, Alger, Algeria. Products: PVC and PET packaging (boxes, lids, trays) made to client specification using die-cut moulds ("Formes de découpe" / "Lmoule").

**Problem being solved:** The business runs entirely on a 45-tab Google Sheet (`Gestionnaire ASCO.xlsx`). It is fragile, not shareable, and error-prone. AscoSys 1.0 replaces it with a proper web CRM.

**Core workflow:** A client orders packaging → a sales document is created → it generates both a **Facture PDF** (invoice with price) and a **Bon de Livraison PDF** (delivery note) sharing the same number → payment is recorded against the invoice → client balance is tracked.

**Locale:** French UI throughout. Currency: Algerian Dinar (DZD). VAT: 19% (TVA). Fiscal rules follow Algerian law (droit de timbre, 2025/2026 barème).

---

## 2. Tech Stack (exact versions — do not upgrade without testing)

```
Next.js          16.2.10   (App Router, React Server Components)
React            19.2.4
TypeScript       ^5
Tailwind CSS     ^4        (CSS-first config, no tailwind.config.js)
@supabase/ssr    ^0.12.0
@supabase/supabase-js  ^2.110.0
@react-pdf/renderer    ^4.5.1
recharts         ^3.9.2
lucide-react     ^1.23.0
date-fns         ^4.4.0
class-variance-authority ^0.7.1
clsx             ^2.1.1
tailwind-merge   ^3.3.0
xlsx             0.20.3    (from cdn.sheetjs.com, not npm)
tsx              ^4.23.0   (dev — runs the import script)
dotenv           ^17.4.2   (dev — for the import script)
```

**Critical config:**
- `next.config.ts`: must set `serverExternalPackages: ["@react-pdf/renderer"]` — the PDF renderer must run server-side, not in the browser bundle.
- The middleware file is `src/proxy.ts` (not `middleware.ts`) — Next.js 16 convention change.
- Turbopack is used for dev (`next dev` automatically uses it in Next 16).
- No shadcn CLI — all UI components are hand-built in `src/components/ui/`.

---

## 3. Theme & Design System

**Dark JARVIS aesthetic.** CSS variables defined in `src/app/globals.css` using Tailwind v4 `@theme` directive:

```css
@theme {
  --color-background: hsl(220 15% 7%);
  --color-foreground: hsl(210 20% 92%);
  --color-primary: hsl(185 80% 48%);        /* cyan accent */
  --color-primary-foreground: hsl(220 15% 7%);
  --color-surface: hsl(220 13% 10%);
  --color-surface-2: hsl(220 12% 14%);
  --color-border: hsl(220 10% 18%);
  --color-muted: hsl(210 10% 55%);
  --color-muted-foreground: hsl(210 10% 55%);
  --color-success: hsl(145 60% 45%);
  --color-warning: hsl(38 90% 55%);
  --color-danger: hsl(0 70% 55%);
  --color-card: hsl(220 13% 11%);
}
```

All UI components use these CSS variables via Tailwind utility classes (`bg-surface`, `text-primary`, `border-border`, etc.). The sidebar is `w-60`, hidden on mobile (hamburger in topbar). No light mode.

---

## 4. Project File Structure

```
src/
  app/
    globals.css                     # Tailwind v4 theme + base styles
    layout.tsx                      # Root layout (font, metadata)
    (app)/
      layout.tsx                    # Authenticated shell (sidebar + topbar, auth redirect)
      page.tsx                      # Dashboard
      clients/page.tsx
      produits/page.tsx
      formes/page.tsx
      tarification/page.tsx
      factures/page.tsx
      bons-livraison/page.tsx
      ventes/
        page.tsx                    # Redirects to /factures
        nouveau/page.tsx            # New document (reads ?type=facture|bon)
        [id]/page.tsx               # Edit existing document
        ventes-list.tsx             # Shared list component (mode prop)
        document-editor-wrapper.tsx # Thin server wrapper for the editor
        actions.ts                  # saveDocument, deleteDocuments, reconcileDocumentPayment
      paiements/
        page.tsx
        paiements-view.tsx
        actions.ts                  # savePayment, deletePayments, updateOpeningBalance
      prospects/
        page.tsx
        prospects-view.tsx
        actions.ts
      devis/
        page.tsx
        nouveau/page.tsx
        [id]/page.tsx
        [id]/pdf/route.ts           # Proforma PDF route
        actions.ts                  # saveProforma, validateProforma, saveDeposit
      commande-en-instance/
        page.tsx
        commande-view.tsx
        actions.ts                  # saveOrder, deleteOrder, setOrderStatut, moveOrderPriority, moveOrderShift, reorderQueue
      tresorerie/
        page.tsx
        tresorerie-view.tsx
        actions.ts
      situation-client/
        page.tsx
        situation-view.tsx
      salaires/
        page.tsx
        salaires-view.tsx
        actions.ts
      parametres/
        page.tsx
        parametres-view.tsx
        actions.ts
    login/page.tsx
    facture/route.ts                # GET → streams Facture PDF
    bon-livraison/route.ts          # GET → streams BL PDF
    situation-client/pdf/route.ts   # GET → streams Statement PDF
    versement/route.ts              # GET → streams Bon de versement PDF (?payment=|?deposit=)
  components/
    ui/
      badge.tsx
      button.tsx
      card.tsx                      # Card, CardHeader, CardTitle, CardDescription, CardContent
      checkbox.tsx
      combobox.tsx                  # Searchable select with fixed-position dropdown
      input.tsx
      label.tsx
      modal.tsx
      select.tsx
      selection-bar.tsx             # Bulk-action bar (delete N items)
      stat-card.tsx
      table.tsx                     # Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty
      table-controls.tsx            # useTableControls, applyTableControls, HeaderMenu (Excel-style sort/filter)
      textarea.tsx
    layout/
      brand.tsx                     # AscoSys logo mark
      nav.ts                        # NAV_ITEMS array
      page-header.tsx               # PageHeader with title, description, actions slot
      sidebar.tsx
      supabase-notice.tsx           # Demo-mode banner
      topbar.tsx
    auth/
      login-form.tsx
      logout-button.tsx
    dashboard/
      revenue-chart.tsx
    pdf/
      sales-document-pdf.tsx        # Facture + BL PDF (3 variants)
      proforma-pdf.tsx
      statement-pdf.tsx
      versement-pdf.tsx
    ventes/
      document-editor.tsx           # Full sales document editor (lines, totals, statut)
    devis/
      devis-editor.tsx
  lib/
    company.ts                      # COMPANY const (legal header data)
    fiscal.ts                       # droitTimbre(), droitTimbreSiEspeces()
    format.ts                       # formatDZD(), formatNumber(), formatDate(), todayISO()
    utils.ts                        # cn() helper
    supabase/
      client.ts                     # createBrowserClient()
      server.ts                     # createClient() — async, cookie-based
      middleware.ts                 # updateSession() for src/proxy.ts
      config.ts                     # getSupabaseConfig() — reads env, returns null in demo mode
      types.ts                      # Full Database type + all entity types
    data/
      catalog.ts                    # getClientsAndProducts() — used by editors
      numero.ts                     # suggestNumero(type) — preview next invoice/BL number
      statement.ts                  # buildStatement(clientId, year) — for Situation client
supabase/migrations/
  0001_init.sql
  0002_upgrades.sql
  0003_invoicing.sql
  0004_products_traces.sql
  0005_leads_queue.sql
scripts/
  import-sheet.ts                   # npm run import — reads Gestionnaire ASCO.xlsx
public/
src/proxy.ts                        # Next.js 16 middleware (auth session refresh)
next.config.ts
tsconfig.json
package.json
.env.local                          # NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
.env.example
```

---

## 5. Authentication & Demo Mode

**Auth:** Supabase Auth (email/password). `src/proxy.ts` (the middleware) calls `updateSession()` on every request to refresh the JWT cookie. The `(app)/layout.tsx` server component checks `supabase.auth.getUser()` — if no user, redirects to `/login`.

**Demo mode:** if `.env.local` is empty or the env vars are not set, `getSupabaseConfig()` returns `null`. All server components and actions detect this and return mock/empty data instead of calling Supabase. Auth is bypassed — any route is accessible. A `<SupabaseNotice>` banner appears telling the user they are in demo mode.

**Service role key:** `SUPABASE_SERVICE_ROLE_KEY` is used only in:
- `scripts/import-sheet.ts` (bypasses RLS for bulk insert)
- Certain server actions that need to bypass RLS (e.g. creating counters)
Never passed to the browser.

---

## 6. Database Schema

All migrations run in Supabase SQL Editor in order 0001 → 0005.

### 0001_init.sql — Base schema

```sql
-- profiles (linked to auth.users)
profiles (id uuid PK refs auth.users, full_name text, role text DEFAULT 'admin', created_at)

-- clients
clients (id uuid PK, company_name text NOT NULL, contact_person text,
         client_type text DEFAULT 'entreprise',  -- entreprise | artisan | particulier
         rc text, carte_artisan text, nif text, art text, nis text,
         address text, phone text, email text, industry_type text, notes text,
         solde_ouverture numeric DEFAULT 0, created_at)

-- formes (die-cut moulds)
formes (id uuid PK, ref text NOT NULL UNIQUE, fournisseur text,
        longueur numeric, largeur numeric, hauteur numeric, hauteur_couvercle numeric,
        longueur_forme numeric, largeur_forme numeric, nb_poses integer,
        laize_utilisee text, poids_par_feuille numeric,
        storage_location text, notes text, created_at)

-- products
products (id uuid PK, name text NOT NULL, ref text, client_id uuid refs clients,
          forme_id uuid refs formes, trace text,  -- path in 'traces' storage bucket
          active boolean DEFAULT true, created_at)

-- product_prices (history-enabled; client_id null = general price)
product_prices (id uuid PK, product_id uuid refs products NOT NULL,
                client_id uuid refs clients,  -- null = general; non-null = per-client override
                prix_unitaire numeric NOT NULL, valid_from date DEFAULT today, created_at)

-- sales_documents
sales_documents (id uuid PK, numero text NOT NULL,
                 date date DEFAULT today, client_id uuid refs clients NOT NULL,
                 type text NOT NULL,         -- 'facture' | 'bon'
                 tva_rate numeric DEFAULT 0.19,
                 total_ht numeric DEFAULT 0, total_tva numeric DEFAULT 0,
                 timbre numeric DEFAULT 0,   -- droit de timbre (espèces factures only)
                 total_ttc numeric DEFAULT 0,
                 paiement_mode text,         -- 'espece' | 'cheque' | 'virement' | null
                 statut text DEFAULT 'brouillon',  -- 'brouillon' | 'valide' | 'paye'
                 historique boolean DEFAULT false,  -- true = imported legacy doc, excluded from AR
                 notes text, created_at)

-- sales_document_lines
sales_document_lines (id uuid PK, document_id uuid refs sales_documents NOT NULL,
                      product_id uuid refs products, designation text NOT NULL,
                      quantite numeric NOT NULL, prix_unitaire numeric NOT NULL,
                      total_ht numeric NOT NULL, position integer DEFAULT 0)

-- payments
payments (id uuid PK, client_id uuid refs clients NOT NULL,
          document_id uuid refs sales_documents,  -- optional link
          date date DEFAULT today, montant numeric NOT NULL,
          mode text NOT NULL,     -- 'espece' | 'cheque' | 'virement'
          reference text, note text, created_at)

-- caisse (legacy — superseded by transactions in 0002, kept for data)
caisse (id uuid PK, date date, entree numeric DEFAULT 0, sortie numeric DEFAULT 0,
        observation text, action_par text, created_at)

-- employees
employees (id uuid PK, name text NOT NULL, role text,
           salaire_mensuel numeric DEFAULT 0, active boolean DEFAULT true, created_at)

-- salary_entries
salary_entries (id uuid PK, employee_id uuid refs employees NOT NULL,
                date date DEFAULT today,
                type text NOT NULL,  -- 'accrual' | 'avance' | 'paiement'
                montant numeric NOT NULL, note text, created_at)

-- leaves
leaves (id uuid PK, employee_id uuid refs employees NOT NULL,
        date date, jours integer, type text, note text, created_at)

-- VIEWS
client_balance AS (
  SELECT c.id AS client_id, c.company_name,
    COALESCE(c.solde_ouverture, 0) AS solde_ouverture,
    COALESCE(SUM(d.total_ttc) FILTER (WHERE d.id IS NOT NULL AND NOT d.historique), 0) AS total_facture,
    COALESCE(SUM(p.montant) FILTER (WHERE p.id IS NOT NULL), 0) AS total_paye,
    COALESCE(c.solde_ouverture, 0)
      + COALESCE(SUM(d.total_ttc) FILTER (WHERE d.id IS NOT NULL AND NOT d.historique), 0)
      - COALESCE(SUM(p.montant) FILTER (WHERE p.id IS NOT NULL), 0) AS solde
  FROM clients c
  LEFT JOIN sales_documents d ON d.client_id = c.id
  LEFT JOIN payments p ON p.client_id = c.id
  GROUP BY c.id, c.company_name, c.solde_ouverture
)

caisse_running AS (running solde on caisse table)
```

### 0002_upgrades.sql

```sql
-- transaction_categories
transaction_categories (id uuid PK, name text NOT NULL, direction text,  -- 'in'|'out'|'both'
                        color text DEFAULT '#6B7280', sort_order integer DEFAULT 0,
                        active boolean DEFAULT true, is_system boolean DEFAULT false, created_at)

-- Default categories seeded: Encaissement client, Achat matières, Salaires, Charges, Divers entrée, Divers sortie

-- transactions (replaces caisse for new entries)
transactions (id uuid PK, date date NOT NULL, direction text NOT NULL,  -- 'in' | 'out'
              montant numeric NOT NULL, category_id uuid refs transaction_categories,
              tiers text, reference text, description text, created_at)

-- VIEW: transactions_running (adds running solde column)

-- clients.solde_ouverture already in 0001 but ensured here
-- product_prices: dropped prix_palette, qte_par_palette, nombre_cartons columns
-- Rewrites client_balance view to exclude historique docs
```

### 0003_invoicing.sql

```sql
-- facture_counters
facture_counters (year integer PK, last integer DEFAULT 0)

-- bl_counters
bl_counters (year integer, month integer, last integer DEFAULT 0, PRIMARY KEY (year, month))

-- proforma_counters
proforma_counters (year integer PK, last integer DEFAULT 0)

-- RPC functions (SECURITY DEFINER — collision-safe atomic increment):
next_facture_numero() RETURNS text
  -- increments facture_counters.last for current year, returns 'N/YY'
  -- e.g. last=20 → returns '21/26', sets last=21

next_bl_numero() RETURNS text
  -- increments bl_counters for current year+month, returns 'N/MM/YY'

next_proforma_numero() RETURNS text
  -- same pattern for proformas
```

### 0004_products_traces.sql

```sql
-- Moves tech specs from products to formes:
-- formes gains: laize_utilisee text, poids_par_feuille numeric
-- products simplified to: id, name, ref, client_id, forme_id, trace, active, created_at
-- Storage bucket 'traces' created (public read, authenticated write)
--   traces bucket holds PDF files uploaded per product
--   path pattern: {product_id}/{filename}.pdf
```

### 0005_leads_queue.sql

```sql
-- prospects
prospects (id uuid PK, name text NOT NULL, contact_person text, phone text, email text,
           industry_type text, notes text,
           status text DEFAULT 'nouveau',  -- 'nouveau'|'en_discussion'|'gagne'|'perdu'
           client_id uuid refs clients,    -- set when converted to client
           created_at)

-- proformas
proformas (id uuid PK, numero text NOT NULL, prospect_id uuid refs prospects,
           client_id uuid refs clients,   -- one of prospect_id or client_id is set
           date date DEFAULT today, tva_rate numeric DEFAULT 0.19,
           total_ht numeric DEFAULT 0, total_tva numeric DEFAULT 0, total_ttc numeric DEFAULT 0,
           statut text DEFAULT 'brouillon',  -- 'brouillon'|'envoye'|'valide'|'refuse'
           notes text, created_at)

-- proforma_lines
proforma_lines (id uuid PK, proforma_id uuid refs proformas NOT NULL,
                product_id uuid refs products, designation text NOT NULL,
                quantite numeric NOT NULL, prix_unitaire numeric NOT NULL,
                total_ht numeric NOT NULL, position integer DEFAULT 0)

-- prospect_deposits (acomptes on proformas)
prospect_deposits (id uuid PK, prospect_id uuid refs prospects NOT NULL,
                   proforma_id uuid refs proformas, date date DEFAULT today,
                   montant numeric NOT NULL, mode text NOT NULL, note text, created_at)

-- order_queue (production backlog)
order_queue (id uuid PK, client_id uuid refs clients, product_id uuid refs products,
             designation text NOT NULL, quantite numeric, laize_utilisee text,
             date_prevue date, shift text DEFAULT 'matin',  -- 'matin' | 'soir'
             priority integer DEFAULT 0,
             statut text DEFAULT 'en_attente',  -- 'en_attente'|'en_cours'|'termine'|'livre'
             proforma_id uuid refs proformas, notes text, created_at)
```

---

## 7. TypeScript Types

All types in `src/lib/supabase/types.ts`. Key ones:

```typescript
type ClientType = "entreprise" | "artisan" | "particulier";
type SalesDocumentType = "bon" | "facture";
type SalesDocumentStatut = "brouillon" | "valide" | "paye";
type PaymentMode = "cheque" | "espece" | "virement";
type ProspectStatus = "nouveau" | "en_discussion" | "gagne" | "perdu";
type ProformaStatut = "brouillon" | "envoye" | "valide" | "refuse";
type OrderShift = "matin" | "soir";
type OrderStatut = "en_attente" | "en_cours" | "termine" | "livre";
type SalaryEntryType = "accrual" | "avance" | "paiement";
type TransactionDirection = "in" | "out";

// View types
type ClientBalance = {
  client_id: string; company_name: string;
  solde_ouverture: number; total_facture: number; total_paye: number; solde: number;
};
type EmployeeBalance = {
  employee_id: string; name: string; salaire_mensuel: number;
  total_du: number; total_verse: number; reste_a_payer: number;
};
```

The `Database` type follows Supabase's typed client pattern with `Tables`, `Views`, `Functions` keys.

---

## 8. Supabase Client Setup

```typescript
// src/lib/supabase/server.ts — used in Server Components and Server Actions
export async function createClient() {
  const config = getSupabaseConfig();
  if (!config) return demoClient();  // returns a no-op client in demo mode
  const cookieStore = await cookies();
  return createServerClient<Database>(config.url, config.anonKey, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(...) }
  });
}

// src/lib/supabase/client.ts — used in Client Components
export function createBrowserClient() {
  return createBrowserClientSSR<Database>(url, anonKey);
}
```

`src/proxy.ts` (the middleware):
```typescript
export async function middleware(request: NextRequest) {
  return await updateSession(request);  // refreshes Supabase session cookie
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'] };
```

---

## 9. Invoice Numbering System

**Factures:** `N/YY` — e.g. `21/26` (invoice 21 of year 2026)
**Bons de livraison:** `N/MM/YY` — e.g. `40/07/26` (BL 40 of July 2026)
**Proformas:** `N/YY` — same pattern as factures but separate counter

**Counter tables** (`facture_counters`, `bl_counters`, `proforma_counters`) store the `last` used number per year (and month for BL). The RPC functions `next_facture_numero()`, `next_bl_numero()`, `next_proforma_numero()` atomically increment and return the next number — they are `SECURITY DEFINER` to guarantee collision-safety.

**`suggestNumero(type)`** in `src/lib/data/numero.ts` peeks at the counter without consuming it, to show a suggested number in the "new document" form. It skips already-used numbers by checking `sales_documents.numero`. The user can edit this suggested number before saving.

**`saveDocument`** in `ventes/actions.ts`: for new documents, if the user provided a custom numero, use it directly and skip the RPC; if not provided (or falls back), call the RPC. Either way, the counter is the source of truth.

**Reset via Paramètres:** the Paramètres page allows manually setting `facture_counters.last` and `bl_counters.last` (e.g. to account for invoices issued outside the system).

---

## 10. Sales Document Editor

`src/components/ventes/document-editor.tsx` — the core of the app. It handles both new and existing documents.

**Props:**
```typescript
type DocumentEditorProps = {
  mode: "facture" | "bon";
  initialDoc?: EditorDocument;         // undefined = new document
  suggestedNumero?: string;            // pre-filled suggested number (editable)
  clients: ClientOption[];
  products: ProductOption[];
  overrides: PriceOverride[];          // per-client price overrides
};
```

**State managed:**
- `header`: DocumentInput (date, client_id, type, tva_rate, statut, paiement_mode, paye_livraison, notes, numero)
- `lines`: LineInput[] (product_id, designation, quantite, prix_unitaire)

**Computed totals (live):**
```
total_ht  = sum(quantite × prix_unitaire) per line
total_tva = total_ht × tva_rate
timbre    = droitTimbreSiEspeces(total_ht + total_tva, paiement_mode)   // only if espèces
total_ttc = total_ht + total_tva + timbre
```

**Line auto-fill:** when a product is selected, the editor looks up the price in `overrides` (client-specific) first, then falls back to the general price from `products`. The designation is pre-filled from the product name.

**Statut transitions:**
- `brouillon` → `valide` → `paye`
- When set to `paye`, `reconcileDocumentPayment` runs: it computes the remaining unpaid amount (total_ttc − sum of existing payments for this doc) and auto-inserts a payment tagged `[AUTO-PAYE]`
- When reverted from `paye`, the `[AUTO-PAYE]` payment is deleted
- `historique` documents are excluded from this logic (no auto-payment on imported data)

**Bon de livraison variants:**
- `paye_livraison` field: amount paid at delivery — inserts a client payment immediately on save
- Bons default to statut `valide` (never `brouillon`)

**PDF generation:** the editor has a "Générer PDF" button that opens `/facture?id={id}` or `/bon-livraison?id={id}` in a new tab.

---

## 11. PDF Generation

All PDFs use `@react-pdf/renderer`. PDF routes stream a binary PDF response.

**Route pattern:**
```typescript
// app/facture/route.ts
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  // fetch document + lines + client from Supabase
  const stream = await renderToStream(<SalesDocumentPDF ... />);
  return new Response(stream as unknown as ReadableStream, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=..." }
  });
}
```

**`SalesDocumentPDF`** has 3 variants based on document type + context:
1. **facture** — shows prices, TVA, timbre, total TTC, droit de timbre line if applicable
2. **bon-facture** — delivery note for an already-invoiced order (qty only, no prices)
3. **bon** — standalone priced BL (has TVA + total TTC)

**Legal header** on all PDFs (from `src/lib/company.ts`):
```
EURL ASCO TRADING
Route Khraycia, Propriété N°05, Section 04, Local 01, Douera, Alger
RC: 16/00 1017543 B22 | NIF: 002216101754312 | ART: 16540708084 | NIS: 002216540002167
CPA Banque — Agence SOFITEL, Alger | RIB: 4000306826-43
```

**Client header on PDFs:** conditionally shows RC/NIF/ART/NIS (entreprise), Carte artisan (artisan), or neither (particulier).

**Other PDFs:**
- `proforma-pdf.tsx` — devis/proforma with "PROFORMA" watermark
- `statement-pdf.tsx` — situation client statement (chronological debit/credit table)
- `versement-pdf.tsx` — bon de versement (receipt) for a payment or prospect deposit; shows client balance or devis remaining

---

## 12. Droit de Timbre (Algerian Stamp Duty)

`src/lib/fiscal.ts` — applies only to **factures paid in cash (espèces)**. Progressive by 100 DA tranches, 2025/2026 barème:

```
300 DA → 30 000 DA  :  1 DA per 100 DA tranche   (~1%)
30 001 DA → 100 000 DA : 1.5 DA per 100 DA tranche  (~1.5%)
> 100 000 DA         :  2 DA per 100 DA tranche   (~2%)
```

Every fraction of 100 DA counts as a full tranche. Result rounded to nearest dinar. Stored in `sales_documents.timbre` and folded into `total_ttc`. Appears as a separate line item on the Facture PDF.

---

## 13. Number Formatting

`src/lib/format.ts` — custom formatter, NOT using `Intl.NumberFormat` for DZD because the Helvetica font in `@react-pdf/renderer` doesn't support narrow no-break spaces.

```
Format: space as thousands separator, dot as decimal
Example: 585585585.25 → "585 585 585.25 DA"
```

```typescript
formatDZD(value)            // "585 585 585.25 DA"
formatNumber(value, digits) // "9 930" or "12.5"
formatDate(value)           // "06/07/2026"
formatDateTime(value)       // "06/07/2026 14:30"
todayISO()                  // "2026-07-09"
```

---

## 14. UI Component Kit

All hand-built in `src/components/ui/`. Key components:

**`<Combobox>`** — searchable select with fixed-position dropdown (critical pattern):
- Uses `useRef` on the trigger button and calls `getBoundingClientRect()` on open
- Dropdown is `position: fixed` using the computed `{left, top, width}` from the rect
- This escapes CSS stacking context traps caused by `backdrop-filter: blur()` on parent `Card` elements
- Without this fix, the dropdown clips behind the card header

**`<HeaderMenu>`** (in `table-controls.tsx`) — same fixed-position technique for Excel-style sort/filter column menus.

**`useTableControls` hook** — provides `{ sort, filters, toggle, setSort, setFilter, clear }`. `applyTableControls(rows, controls)` applies sort + filter to any array. Used in: Clients, Produits, Factures, Bons lists.

**`useSelection` hook** — multi-row checkbox selection. `sel.selected: Set<string>`, `sel.count`, `sel.allChecked`, `sel.someChecked`, `sel.toggle(id)`, `sel.toggleAll()`, `sel.clear()`.

**`<SelectionBar>`** — sticky bottom bar that appears when `count > 0`, shows "N items sélectionnés" with a delete button.

**`<Modal>`** — controlled modal with backdrop click to close, keyboard escape handler.

**`<StatCard>`** — dashboard metric card with `label`, `value`, `icon`, `accent` (`"success"|"warning"|"danger"|"default"`).

**`<PageHeader>`** — page title, description, and right-side actions slot.

---

## 15. Situation Client (Account Statement)

`src/lib/data/statement.ts` — `buildStatement(clientId, year)`:

- Fetches all `sales_documents` + their `proforma_lines` (treated as product lines) for the client in the year
- Fetches all `payments` for the client in the year
- Computes "Report à nouveau" = all orders before the year minus all payments before the year (excluding `historique` filter — the statement includes all docs for full history)
- Returns a chronological `StatementEvent[]` union:
  - `{ type: "order", date, numero, lines: [...], total }` — debit column
  - `{ type: "payment", date, montant, mode, reference }` — credit column
- Running balance maintained throughout

Columns on-screen and in PDF:
- "Crédit" = what the client owes (orders)
- "Versement" = what the client paid (payments)
- Running "Solde" column

---

## 16. Commande en Instance (Production Queue)

`src/app/(app)/commande-en-instance/commande-view.tsx`

**Two columns:** Shift Matin | Shift Soir. Cards sorted by `priority` (integer, lower = higher in list).

**Drag-and-drop:**
- Grip handle `<span draggable>` with `GripVertical` icon
- `dragId` is a `useRef<string | null>` — NOT state — so there's no re-render mid-drag
- `onDragStart`: set `dragId.current = order.id`
- `onDragOver` on cards and columns: update `dropHint` state (highlight target)
- `onDrop`: call `handleDrop(targetShift, targetIndex)`
- `handleDrop`: rebuilds the target column's order array, computes new priorities, optimistic-updates local state, then calls `reorderQueue` server action
- Button fallbacks: ChevronUp/Down (priority), ArrowLeftRight (shift change) — for touch devices

**Server action `reorderQueue(items: {id, shift, priority}[])`:** upserts all items in one batch.

---

## 17. Proforma → Client Conversion (validateProforma)

`src/app/(app)/devis/actions.ts` — `validateProforma(proformaId)`:

All operations in one server-side transaction:
1. Load proforma + lines + prospect + deposits
2. Create a new `client` from the prospect data
3. For each proforma line: ensure the product exists (or create it), set the client price
4. Create `order_queue` entries (one per line, shift=matin, statut=en_attente)
5. Carry over `prospect_deposits` as `payments` for the new client
6. Set `prospect.status = 'gagne'`, `prospect.client_id = newClient.id`
7. Set `proforma.statut = 'valide'`, `proforma.client_id = newClient.id`

After validation, the proforma is linked to the real client and its deposits appear in the payment journal.

---

## 18. Payment Auto-Reconciliation

`ventes/actions.ts` — `reconcileDocumentPayment(supabase, docId, newStatut, oldStatut)`:

Called inside `saveDocument` whenever `statut` changes on a non-historique document:

```
If newStatut === 'paye' and oldStatut !== 'paye':
  remaining = document.total_ttc − sum(payments where document_id = docId and note != '[AUTO-PAYE]')
  if remaining > 0:
    insert payment { client_id, document_id, montant: remaining, mode: document.paiement_mode ?? 'virement', note: '[AUTO-PAYE]' }

If newStatut !== 'paye' and oldStatut === 'paye':
  delete payments where document_id = docId AND note = '[AUTO-PAYE]'
```

The `[AUTO-PAYE]` tag is stripped from display in the payment journal (shown as blank note to the user).

---

## 19. Data Import Script

`scripts/import-sheet.ts` — `npm run import` (uses `tsx` to run TypeScript directly):

Reads `Gestionnaire ASCO.xlsx` from `Documents\AscoSys\` (or `--file` arg). Uses SheetJS.

Sheets imported:
- **CLIENT** → `clients` (company_name, RC, NIF, ART, NIS, phone; fuzzy dedup on company_name)
- **FORME BELHADJ** → `formes` (ref, dimensions, poses)
- **PRODUITS** → `products` (name, ref; links forme_id by ref match)
- **LISTE DES PRIX** → `product_prices` (prix_unitaire; matches product by designation)
- **VENTES** (all years) → `sales_documents` + `sales_document_lines` (tagged `historique=true`, `[IMPORT-VENTES]` in notes)

Flags:
- `--reset` : truncates all tables then re-imports
- `--sheet "VENTES 2024"` : import only one sheet

Among the 579 imported VENTES docs: 43 with `numero` matching `N/YY` (year segment 24–27) were reclassified `type='facture'`; the remaining 536 are `type='bon'`. All have `historique=true` and are excluded from the `client_balance` AR calculation.

---

## 20. Navigation Structure

```
Général
  Tableau de bord          /

Catalogue
  Clients                  /clients
  Produits                 /produits
  Formes de découpe        /formes
  Tarification             /tarification

Commercial
  Prospects                /prospects
  Devis / Proforma         /devis
  Factures                 /factures
  Bons de livraison        /bons-livraison
  Paiements & Solde        /paiements

Production
  Commande en instance     /commande-en-instance

Finances
  Trésorerie               /tresorerie
  Situation client         /situation-client
  Salaires                 /salaires

Système
  Paramètres               /parametres
```

`/ventes` redirects to `/factures`. The sales document editor is shared at `/ventes/nouveau?type=facture|bon` and `/ventes/[id]`. Factures and Bons lists are the same `DocumentsList` component with a `mode` prop.

---

## 21. Server Actions Pattern

All mutations use Next.js Server Actions (`"use server"` files in each route directory). Pattern:

```typescript
"use server";
export type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveX(id: string | null, input: XInput): Promise<ActionResult> {
  // validate
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("table").update(data).eq("id", id)
    : await supabase.from("table").insert(data);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/route");
  return { ok: true };
}
```

Client components call actions with `useTransition`:
```typescript
const [pending, start] = useTransition();
function submit() { start(async () => { const res = await saveX(...); if (!res.ok) setError(res.error); }); }
```

---

## 22. Key Business Rules to Preserve

1. **TVA:** 19% default, configurable per document (some BLs are TVA-exempt: `tva_rate = 0`)
2. **Droit de timbre:** only on `type='facture'` AND `paiement_mode='espece'`. Zero for bons, cheques, virements.
3. **Historique flag:** imported documents have `historique=true`. They are excluded from `client_balance` (AR) but included in `situation-client` statement (full history view).
4. **Proforma deposits:** recorded in `prospect_deposits`, appear in `Bon de versement` PDF. Carried to `payments` on validation.
5. **Invoice numero editable on creation:** the user sees the suggested next number but can override it (for invoices issued outside the system that need to be recorded retroactively).
6. **BL "payé à la livraison":** the `paye_livraison` field inserts a payment immediately on save, linked to the BL's document_id.
7. **Bon de versement PDF:** accessible at `/versement?payment={id}` or `/versement?deposit={id}`. Shows the client name, amount, mode, date, and the remaining balance.
8. **Client types on PDFs:**
   - `entreprise` → shows RC, NIF, ART, NIS
   - `artisan` → shows Carte artisan number instead of RC
   - `particulier` → no fiscal IDs shown
9. **Per-client pricing:** `product_prices` with a non-null `client_id` overrides the general price for that client. The sales editor auto-selects the most specific price.
10. **Salary model:** `accrual` entries (monthly salary accumulated) minus `avance` and `paiement` entries = `reste_a_payer`. The dashboard shows per-employee balances.

---

## 23. Future Phases (out of scope for 1.0)

- Windows desktop app via Tauri (same Next.js frontend, wrapped)
- iOS app (SwiftUI or React Native) connecting to the same Supabase API
- Full manufacturing ERD modules: Design/Tracé, Production Runs, Quality Records, Suppliers, Materials/BOM, Equipment
- Multi-user roles (commercial vs. atelier vs. admin) with RLS policies per role
- Email sending (Facture PDF attached to client email)
- Stripe / payment gateway integration

---

## 24. Environment Variables

```env
# .env.local (never commit)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...   # safe for browser
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...        # server-side only, never expose
```

If these are empty/missing: demo mode activates (auth bypassed, Supabase calls skipped).

---

## 25. Build & Verification

```bash
npm run build    # must complete with 0 errors (tsc + eslint + Next.js build)
npm run dev      # dev server at http://localhost:3000
npm run import   # import from Gestionnaire ASCO.xlsx
```

All 17+ routes must return HTTP 200 in demo mode. The PDF routes (`/facture`, `/bon-livraison`, `/devis/[id]/pdf`, `/versement`, `/situation-client/pdf`) require real Supabase data to render (they stream binary PDF).
