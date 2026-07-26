# AscoSys 1.0

CRM and invoicing system for **EURL ASCO TRADING** (ASCO Trading Group) — custom packaging manufacturer, Douera, Alger, Algeria. Replaces a 45-tab Google Sheet. UI is in French. Currency: DZD. VAT: 19%.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.10 |
| UI | React | 19.2.4 |
| Language | TypeScript | ^5 |
| Styling | Tailwind CSS v4 | ^4 |
| Database / Auth | Supabase (Postgres + Auth) | ^2.110.0 |
| PDF generation | @react-pdf/renderer | ^4.5.1 |
| Charts | Recharts | ^3.9.2 |
| Icons | Lucide React | ^1.23.0 |
| Excel import | SheetJS (xlsx) | 0.20.3 |
| Runtime | Node.js | ≥ 20 |
| Package manager | npm | — |

Theme: dark "JARVIS" aesthetic — near-black background, cyan (`hsl(185 80% 48%)`) primary accent, hand-built UI component kit (no shadcn CLI used).

---

## Modules

### Général
- **Tableau de bord** `/` — monthly revenue chart, top clients, outstanding balances summary

### Catalogue
- **Clients** `/clients` — client directory (RC, NIF, ART, NIS, Carte artisan), three types: entreprise / artisan / particulier
- **Produits** `/produits` — product catalogue linked to die-cut forms; trace PDF upload
- **Formes de découpe** `/formes` — die-cut mould catalogue (dimensions, poses, laize)
- **Tarification** `/tarification` — price list per product, per-client override, history

### Commercial
- **Prospects** `/prospects` — lead pipeline (nouveau / en_discussion / gagné / perdu)
- **Devis / Proforma** `/devis` — quote editor with line items, acomptes (deposits), PDF; "Valider" converts to client + products + production orders
- **Factures** `/factures` — invoices list; editor at `/ventes/nouveau?type=facture`
- **Bons de livraison** `/bons-livraison` — delivery notes list; editor at `/ventes/nouveau?type=bon`
- **Paiements & Solde** `/paiements` — payment journal + client balance ledger (opening balance editable)

### Production
- **Commande en instance** `/commande-en-instance` — two-shift (Matin / Soir) production queue with drag-and-drop reorder

### Finances
- **Trésorerie** `/tresorerie` — categorised cash ledger with running balance
- **Situation client** `/situation-client` — per-client chronological account statement with PDF
- **Salaires** `/salaires` — employee payroll: monthly salary, advances, reste-à-payer

### Système
- **Paramètres** `/parametres` — transaction categories management + invoice numbering reset

---

## Prerequisites

- **Node.js ≥ 20** — https://nodejs.org
- **A Supabase account** (free tier is sufficient) — https://supabase.com
- The file `Gestionnaire ASCO.xlsx` in `Documents\AscoSys\` (for the data import — optional if starting fresh)

---

## First-time Setup

### Step 1 — Create the Supabase project

1. Go to https://supabase.com → **New project**
2. Choose a name, set a strong database password, pick a region close to Algeria (e.g. Frankfurt)
3. Wait for the project to be ready (~1 minute)

### Step 2 — Copy your API keys

In Supabase: **Project Settings → API**

Copy the three values into `.env.local` at the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

> **Never commit `.env.local` to git.** The `SUPABASE_SERVICE_ROLE_KEY` is secret — server-side only.

### Step 3 — Run the database migrations (in order)

In Supabase: **SQL Editor → New query**. Paste each file below and click **Run**, one at a time:

| Order | File | What it creates |
|---|---|---|
| 1 | `supabase/migrations/0001_init.sql` | Base schema: clients, products, sales, payments, payroll, caisse |
| 2 | `supabase/migrations/0002_upgrades.sql` | Trésorerie, opening balance, per-client pricing, `client_balance` view |
| 3 | `supabase/migrations/0003_invoicing.sql` | Client types, droit de timbre, facture/BL counters, invoice RPC functions |
| 4 | `supabase/migrations/0004_products_traces.sql` | Product restructure, traces storage bucket |
| 5 | `supabase/migrations/0005_leads_queue.sql` | Prospects, proformas, order queue, bon de versement |

### Step 4 — Create your login account

Supabase → **Authentication → Users → Add user** (email + password).

### Step 5 — Install dependencies

```bash
cd C:\Users\LENOVO\Dev\ascosys   # or wherever you put the project
npm install
```

### Step 6 — Import reference data (optional)

This imports clients, products, prices and die-cut forms from the Excel file:

```bash
npm run import              # import if tables are empty
npm run import -- --reset   # wipe and re-import
```

The script reads `Gestionnaire ASCO.xlsx` from `Documents\AscoSys\` by default.

---

## Running the App

```bash
npm run dev       # development server → http://localhost:3000
```

For production:

```bash
npm run build     # type-check + compile
npm run start     # serve the compiled build
```

Or deploy to **Vercel** (recommended): connect the repo, add the three env vars in Vercel dashboard, and it deploys automatically.

> **Demo mode:** if `.env.local` is empty or missing, the app starts without a database (auth bypassed, static demo data). Useful to preview the UI before Supabase is configured.

---

## Project Structure

```
ascosys/
├── src/
│   ├── app/
│   │   ├── (app)/              # All authenticated routes
│   │   │   ├── page.tsx        # Tableau de bord
│   │   │   ├── clients/
│   │   │   ├── produits/
│   │   │   ├── formes/
│   │   │   ├── tarification/
│   │   │   ├── factures/
│   │   │   ├── bons-livraison/
│   │   │   ├── ventes/         # Shared sales document editor
│   │   │   │   ├── nouveau/    # New document form
│   │   │   │   └── [id]/       # Edit existing document
│   │   │   ├── prospects/
│   │   │   ├── devis/
│   │   │   ├── paiements/
│   │   │   ├── commande-en-instance/
│   │   │   ├── tresorerie/
│   │   │   ├── situation-client/
│   │   │   ├── salaires/
│   │   │   └── parametres/
│   │   ├── login/              # Login page
│   │   ├── facture/            # PDF route handler
│   │   ├── bon-livraison/      # PDF route handler
│   │   ├── situation-client/pdf/  # Statement PDF
│   │   ├── devis/[id]/pdf/     # Proforma PDF
│   │   └── versement/          # Bon de versement PDF
│   ├── components/
│   │   ├── ui/                 # Hand-built component kit
│   │   ├── layout/             # Sidebar, topbar, nav
│   │   ├── pdf/                # @react-pdf/renderer documents
│   │   ├── ventes/             # Sales document editor
│   │   └── devis/              # Devis/proforma editor
│   └── lib/
│       ├── company.ts          # Company legal info (RC, NIF, etc.)
│       ├── fiscal.ts           # Droit de timbre calculation
│       ├── format.ts           # DZD formatter, date helpers
│       ├── supabase/           # Client, server, middleware, types
│       └── data/               # Server-side data fetchers
├── supabase/migrations/        # 5 SQL migration files
├── scripts/
│   └── import-sheet.ts         # Excel → Supabase import
├── public/                     # Static assets
├── .env.local                  # Your API keys (never commit)
├── .env.example                # Template for env vars
└── Gestionnaire ASCO.xlsx      # Source Excel file (archive)
```

---

## Important Notes

- **Keep the project folder outside OneDrive** to avoid OneDrive syncing `node_modules` (400k+ files, causes corruption and slowdowns). Move the folder to `C:\Users\...\Dev\ascosys` after copying from OneDrive.
- **Migrations must run in order** (0001 → 0005). Each one depends on the previous.
- **Invoice numbering:** Factures = `N/YY` (e.g. `21/26`), Bons = `N/MM/YY` (e.g. `40/07/26`). Reset via Paramètres.
- **Droit de timbre** is calculated automatically on cash (espèces) factures only — Algerian 2025/2026 progressive barème.
- The `SUPABASE_SERVICE_ROLE_KEY` is only used server-side (import script + server actions). Never expose it client-side.
