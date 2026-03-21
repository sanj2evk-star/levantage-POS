# Le Vantage POS — Engineering Quick Start

**Version**: 1.2.0 | **Stack**: Next.js 16 + Supabase + Tailwind/shadcn | **~16,300 LOC**

---

## What is this?

A custom cafe POS system for a 78-table restaurant across 5 sections. Handles the full lifecycle: order taking (POS + mobile waiter app) → KOT printing to 4 Epson thermal printers → kitchen/bar/cafe live displays → billing with GST/SC → payment → day close reconciliation → reports + audit trail.

Currently **pilot-ready** (v1.2.0), running in parallel with an existing paid POS for validation. **Reliability score: 6/10.**

---

## First files to read (in order)

1. `src/types/database.ts` — All TypeScript interfaces; maps 1:1 to DB schema
2. `src/lib/constants.ts` — Sections, stations, payment modes, order statuses
3. `supabase/migrations/001_initial_schema.sql` — Core DB schema (22 tables, RLS, functions)
4. `src/lib/utils/print.ts` — Print flow (KOT + bill printing via print proxy)
5. `src/app/pos/page.tsx` — Core POS: order placement, cart, table selection
6. `src/app/cashier/page.tsx` — Cashier dashboard: tables, billing, settlement
7. `src/lib/utils/business-day.ts` — Business day boundary logic (default 3 AM cutoff)
8. `src/hooks/use-auth.ts` — Auth flow and role-based access
9. `print-server/index.js` — Print proxy: Supabase Realtime → ESC/POS → TCP

---

## Critical flows to understand

| Flow | Key files |
|------|-----------|
| **Order placement** | `pos/page.tsx`, `waiter/page.tsx` → inserts orders, order_items, kot_entries, print_jobs |
| **KOT routing** | Items auto-route to printer by `menu_items.station` field (kitchen/cafe/mocktail) |
| **Billing calculation** | Client-side in cashier billing dialog: subtotal + SC(10%) + GST(5%) - discount |
| **Payment settlement** | Inserts bills + payments → updates order status → frees table |
| **Business day boundary** | Orders at 2:59 AM = yesterday's sales. 3:01 AM = today's. Configurable in settings |
| **Print proxy** | Electron app on Windows PC listens to `print_jobs` table via Realtime → TCP to Epson |

---

## Dangerous areas — do NOT change casually

1. **Billing math** in cashier billing dialog — affects real money
2. **`generate_bill_number()` / `generate_order_number()`** DB functions — affects numbering
3. **Print payload formatting** in `print-server/index.js` — affects physical receipts
4. **RLS policies** in migrations — loosening opens security holes
5. **Middleware auth checks** (`src/middleware.ts`) — controls which routes are public
6. **Table status management** — incorrect transitions create orphaned tables

---

## Top priority fixes (before sole POS use)

| Priority | Fix | Why |
|----------|-----|-----|
| **P0** | Print failure monitoring on cashier dashboard | Silent KOT failures = kitchen never gets order |
| **P0** | `paying` guard on billing (like existing `placing` guard) | Prevents double payment on slow click |
| **P0** | Server-side bill total validation (DB function) | Client-side math can be wrong/tampered |
| **P1** | Optimistic locking on orders (`version` column) | Two staff editing same order = data loss |
| **P1** | Tighten RLS policies by role | Any auth'd user can currently write to most tables |
| **P1** | Auto-free orphaned occupied tables | Tables stuck in 'occupied' with no orders |
| **P2** | Offline order queue (IndexedDB) | Internet outage = complete service halt |
| **P3** | Extract billing logic to shared module | Currently duplicated across pages |
| **P3** | Automated tests for billing math | Zero tests exist today |

---

## Safest first improvements

1. CSS/UI polish — zero business logic risk
2. Print failure banner on cashier dashboard — read-only query, high value
3. `paying` boolean guard — copy of existing `placing` pattern
4. Automated tests for billing math — doesn't change production code
5. Extract billing into shared module — refactor only, no behavior change

---

## Architecture overview

```
Vercel (Next.js 16)          Supabase Cloud              Windows PC
┌─────────────────┐     ┌──────────────────────┐    ┌─────────────────┐
│ /pos             │────▶│ PostgreSQL (22 tables)│    │ Print Proxy     │
│ /cashier         │◀───▶│ Auth (email/pw)       │───▶│ (Electron app)  │
│ /waiter          │     │ Realtime (7 tables)   │    │ ESC/POS → TCP   │
│ /kitchen         │     └──────────────────────┘    │ → Epson printers│
│ /bar, /cafe      │                                  └─────────────────┘
│ /admin (10 pages)│
└─────────────────┘
```

---

## Environment setup

1. Clone repo
2. `cp .env.local.example .env.local` — fill in Supabase + VAPID credentials
3. Run migrations in Supabase SQL Editor (files in `supabase/migrations/`)
4. Create admin user in Supabase Auth dashboard
5. `npm install && npm run dev`
6. Set `SUPABASE_SERVICE_ROLE_KEY` in Vercel env vars for production

---

## Versioning scheme

- **Major** (2.0.0) — big new features, breaking changes
- **Minor** (1.2.0) → (1.3.0) — new features, enhancements
- **Patch** (1.2.0) → (1.2.1) — small bug fixes

All changes logged in `CHANGELOG.txt`. Full details in `PROJECT-HANDOVER.md`.
