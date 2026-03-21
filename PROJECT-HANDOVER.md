# Le Vantage POS — Project Handover Document

**Version**: 1.2.0
**Date**: 2026-03-21
**Codebase**: ~16,300 lines of TypeScript/TSX
**Repository**: [REDACTED — private GitHub repository]

---

## 1. EXECUTIVE SUMMARY

### What this app is
A full-stack cafe Point-of-Sale system for **Le Vantage Cafe Bar**, a multi-section restaurant with 78+ tables across 5 sections (Coffee, Ground Floor, Ground Box, First Floor, First Box). It handles the complete order-to-settlement lifecycle: table management, menu browsing, order placement, KOT printing to 4 Epson thermal printers over LAN, billing with GST/service charge, multiple payment modes, day-close reconciliation, and audit logging.

### What problem it solves
Replaces the existing **Pet Pooja** paid POS system. The cafe was paying ongoing subscription fees for Pet Pooja. This custom system is tailored to Le Vantage's specific workflow (multi-station KOTs, business day boundaries, waiter mobile ordering, bar/cafe display tablets) and eliminates recurring license costs.

### Current maturity level
**Pilot-ready / Early Production**. The system has been running in parallel with Pet Pooja for validation since mid-March 2026. Core workflows (order → KOT → bill → settlement → EOD) are functional and tested in real cafe operations. The app handles real orders, real payments, and real printer output.

### Production readiness assessment
**Pilot-ready with caveats**. The happy path works well. The system needs hardening around edge cases: network failures, concurrent edits, and offline resilience before it can safely be the sole POS.

### Biggest strengths
- **Complete workflow coverage**: Order → KOT → Kitchen Display → Bill → Payment → EOD → Reports — all built
- **Real-time everywhere**: Supabase Realtime powers live updates on cashier dashboard, kitchen display, bar display, waiter notifications
- **Multi-station KOT routing**: Items auto-route to the correct printer (kitchen/cafe/bar) based on menu configuration
- **Cloud-native architecture**: Runs on Vercel + Supabase cloud — no on-premise servers needed except the print proxy
- **Audit trail**: All sensitive operations (cancellations, reprints, refunds, NC orders, SC removals) are logged with staff attribution
- **Business day awareness**: Reports and EOD respect a configurable day boundary (default 3 AM), critical for late-night cafe operations
- **Mobile-optimized waiter app**: Purpose-built for order-taking on phones
- **Tailored to the cafe**: Section prefixes (C/G/GB/F/FB), specific printer IPs, FSSAI compliance, Zomato payment mode

### Biggest risks
- **No offline support**: If internet drops, all operations halt — orders can't be placed, bills can't be printed, KOTs can't fire
- **No automated tests**: Zero test files exist. All validation is manual
- **Print proxy is a single point of failure**: If the Electron print proxy crashes, no KOTs or bills print; no fallback exists
- **Client-side billing logic**: Tax, service charge, and total calculations happen in the browser — not validated server-side
- **RLS policies are permissive**: Any authenticated user can insert audit logs, update KOTs, etc. — role enforcement is primarily UI-level

---

## 2. PRODUCT OVERVIEW

### Core user roles
| Role | Access | Purpose |
|------|--------|---------|
| **Admin** | Full system access | Owner/manager — menu, tables, staff, settings, reports, audit, data |
| **Manager** | Dashboard, menu, tables, reports, EOD, running orders | Shift supervisor |
| **Accountant** | Reports, EOD | Bookkeeper — view-only analytics |
| **Cashier** | POS, billing, EOD | Front desk — takes payments, prints bills |
| **Waiter (Captain)** | Mobile waiter app | Table-side order taking, receives ready notifications |

### Main workflows supported
1. **Order placement** (POS or Waiter app) → table selection → menu browsing → cart → place order
2. **KOT printing** → auto-routed to kitchen/cafe/bar printer based on item station
3. **Kitchen/Bar/Cafe display** → real-time KOT cards → mark preparing → mark ready → notify waiter
4. **Billing** → calculate subtotal + GST (5%) + service charge (10%) → apply discounts → select payment mode → print bill
5. **Payment settlement** → cash/UPI/card/Zomato/NC/split → mark paid → free table
6. **Day close (EOD)** → sales summary → cash denomination counting → reconciliation → close books
7. **Reporting** → item sales, category sales, waiter performance, payment breakdown, settlement tracking
8. **Audit (Hawk Eye)** → view all cancellations, reprints, refunds, NC orders, day closings

### How orders move through the system
```
Waiter/Cashier selects table
  → Browses menu, adds items to cart
  → Places order (INSERT orders + order_items)
  → Table status changes to 'occupied'
  → KOT entries created per station (kitchen/cafe/bar)
  → Print jobs inserted into print_jobs table
  → Print proxy picks up jobs via Realtime subscription
  → ESC/POS commands sent to Epson printers via TCP
  → Kitchen display shows pending KOTs
  → Kitchen staff marks items ready
  → Waiter receives push notification + audio alert
  → Cashier opens billing dialog
  → System calculates: subtotal + GST + SC - discount = total
  → Cashier selects payment mode
  → Bill record created (INSERT bills + payments)
  → Bill printed to billing printer
  → Order status → 'completed'
  → Table status → 'available'
  → Available for EOD reconciliation
```

### Visible assumptions about cafe operations
- All staff have smartphones with browser access (waiter app is web-based)
- Cafe has reliable WiFi covering all areas (printers on LAN, staff on WiFi)
- All printers are Epson thermal (ESC/POS compatible), 80mm paper, on ethernet
- One Windows PC near the cashier runs the print proxy (Electron app)
- Business day can extend past midnight (late-night cafe) — boundary configurable up to 5 AM
- GST is a flat 5% on all items (no multi-rate GST)
- Service charge is a flat 10% (can be waived per order with PIN)
- Menu items don't have complex modifiers — just variants (size) and simple add-ons
- One cafe, one location (no multi-branch support)

---

## 3. TECH STACK

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | Next.js (App Router) | 16.1.6 |
| **UI Framework** | React | 19.2.3 |
| **Styling** | Tailwind CSS v4 + shadcn/ui v4 | 4.x |
| **State Management** | Zustand (auth store) + React useState | 5.0.11 |
| **Database** | PostgreSQL via Supabase | Cloud-hosted |
| **Auth** | Supabase Auth (email/password) | via @supabase/ssr |
| **Realtime** | Supabase Realtime (postgres_changes + broadcast) | Built-in |
| **ORM** | None — direct Supabase client SDK queries | — |
| **Hosting** | Vercel (frontend) + Supabase (backend) | Hobby plan |
| **Printing** | Custom Electron app → TCP to Epson printers | ESC/POS |
| **Push Notifications** | Web Push API via `web-push` library | VAPID |
| **Charts** | Recharts | 3.8.0 |
| **Icons** | Lucide React | 0.577.0 |
| **Toasts** | Sonner | 2.0.7 |
| **Date Utilities** | date-fns | 4.1.0 |

### File structure overview
```
levantage-POS/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── admin/              # Admin panel (dashboard, menu, tables, users, settings, reports, eod, hawkeye, data, running)
│   │   ├── api/                # API routes (admin/users, push/subscribe, push/send)
│   │   ├── bar/                # Bar display + bar login
│   │   ├── cafe/               # Cafe display + cafe login
│   │   ├── cashier/            # Cashier dashboard (not admin)
│   │   ├── kitchen/            # Kitchen display system
│   │   ├── login/              # Main login page
│   │   ├── menu/               # Public QR menu (read-only)
│   │   ├── pos/                # Full POS interface
│   │   ├── setup/              # Print proxy setup guide
│   │   └── waiter/             # Mobile waiter app
│   ├── components/ui/          # shadcn/ui components
│   ├── hooks/                  # Custom hooks (use-auth, use-print-status, use-push-subscription)
│   ├── lib/
│   │   ├── supabase/           # Supabase clients (client.ts, server.ts, admin.ts, middleware.ts)
│   │   ├── store/              # Zustand stores (auth-store.ts)
│   │   ├── utils/              # Utilities (print.ts, notification-sound.ts, business-day.ts, table-display.ts)
│   │   ├── constants.ts        # App constants (sections, stations, payment modes)
│   │   └── utils.ts            # Tailwind cn() helper
│   ├── types/
│   │   └── database.ts         # TypeScript interfaces for all DB tables
│   └── middleware.ts           # Next.js middleware (auth gateway)
├── print-server/               # Electron print proxy app
│   ├── index.js                # Print job processor (Supabase Realtime → ESC/POS → TCP)
│   └── electron-main.js        # Electron tray app with auto-update
├── supabase/
│   └── migrations/             # 24 SQL migration files
├── public/
│   ├── sw.js                   # Service worker (push notifications)
│   └── manifest.json           # PWA manifest
└── CHANGELOG.txt               # Version history
```

---

## 4. FULL ARCHITECTURE MAP

### High-level architecture
```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (Vercel)                     │
│  Next.js 16 App Router                                      │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌───────┐ ┌────────┐ │
│  │ Cashier  │ │  Waiter  │ │Kitchen │ │  Bar  │ │ Admin  │ │
│  │ /cashier │ │ /waiter  │ │/kitchen│ │ /bar  │ │ /admin │ │
│  └────┬─────┘ └────┬─────┘ └───┬────┘ └──┬────┘ └───┬────┘ │
│       │             │           │         │          │       │
│  ┌────▼─────────────▼───────────▼─────────▼──────────▼────┐ │
│  │              Supabase Client SDK                        │ │
│  │  (createClient / createServerClient / createAdminClient)│ │
│  └────────────────────────┬───────────────────────────────┘ │
└───────────────────────────┼─────────────────────────────────┘
                            │ HTTPS / WebSocket
                            ▼
┌───────────────────────────────────────────────────────────────┐
│                    SUPABASE (Cloud)                            │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  PostgreSQL   │  │   Auth       │  │   Realtime         │  │
│  │  (22 tables)  │  │  (email/pw)  │  │  (7 tables pub)    │  │
│  │  + RLS        │  │  + profiles  │  │  + broadcast chan   │  │
│  │  + triggers   │  │              │  │                    │  │
│  └──────┬───────┘  └──────────────┘  └────────┬───────────┘  │
└─────────┼─────────────────────────────────────┼──────────────┘
          │ print_jobs INSERT event              │
          ▼                                     │
┌──────────────────────┐                        │
│  PRINT PROXY         │ ◄──────────────────────┘
│  (Electron on Win PC) │   Realtime subscription
│  ┌────────────────┐  │
│  │  index.js       │  │
│  │  ESC/POS format │  │
│  │  TCP sender     │  │
│  └───────┬────────┘  │
└──────────┼───────────┘
           │ TCP port 9100
           ▼
┌──────────────────────────────────────────────┐
│  EPSON THERMAL PRINTERS (Ethernet LAN)       │
│  ┌──────────┐ ┌──────┐ ┌──────┐ ┌────────┐  │
│  │ Billing  │ │Kitchen│ │ Cafe │ │  Bar   │  │
│  │ [IP:A]   │ │[IP:B] │ │[IP:C]│ │ [IP:D] │  │
│  └──────────┘ └──────┘ └──────┘ └────────┘  │
└──────────────────────────────────────────────┘
```

### API routes summary
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/admin/users` | GET | List users + email map |
| `/api/admin/users` | POST | Create staff member |
| `/api/admin/users` | PATCH | Update staff profile/password |
| `/api/admin/users` | DELETE | Delete staff member |
| `/api/push/subscribe` | POST | Register push subscription |
| `/api/push/subscribe` | DELETE | Unregister push subscription |
| `/api/push/send` | POST | Send push notification to staff |

### How data moves from UI to DB to printer to settlement
1. **UI → DB**: Supabase client SDK direct inserts/updates (no REST API layer for orders/bills)
2. **DB → Printer**: `print_jobs` table acts as a queue; Electron proxy listens via Realtime
3. **DB → Display**: Kitchen/Bar/Cafe pages subscribe to `kot_entries` changes via Realtime
4. **DB → Cashier**: Dashboard subscribes to `orders`, `bills`, `tables` changes
5. **Settlement → EOD**: Bills aggregated by business day range for reconciliation

### Background jobs / workers
- **Print proxy** (`print-server/index.js`): Runs as Electron desktop app on a Windows PC, processes print jobs from Supabase Realtime
- **Stale job cleanup**: Print proxy deletes print_jobs older than 24 hours on startup
- **No server-side cron jobs**: No pg_cron, no Edge Functions, no scheduled tasks
- **Client-side keep-alive**: Bar/cafe displays run `startAudioKeepAlive()` to prevent mobile browser audio suspension

---

## 5. DATABASE + DATA MODEL

### Complete table inventory (22 tables)

| Table | Purpose | Key Columns | Records |
|-------|---------|-------------|---------|
| **profiles** | Staff users (extends auth.users) | id, name, role, phone, pin, is_active | ~10 |
| **categories** | Menu categories | id, name, display_order, is_active | ~15 |
| **menu_items** | Menu items | id, category_id, name, price, station, is_veg, is_active | ~150+ |
| **item_variants** | Size/variant options | id, item_id, name, price_adjustment | ~20 |
| **item_addons** | Optional add-ons | id, name, price, category_id | Few |
| **tables** | Physical dining tables | id, number, section, capacity, status, current_order_id | 78 |
| **orders** | Customer orders | id, table_id, order_number, status, order_type, waiter_id, service_charge_removed, bill_print_count | Growing |
| **order_items** | Line items in orders | id, order_id, menu_item_id, variant_id, quantity, unit_price, total_price, station, is_cancelled | Growing |
| **order_item_addons** | Add-ons on order items | id, order_item_id, addon_id, price | Growing |
| **kot_entries** | Kitchen order tickets | id, order_id, station, kot_number, status, printed_at | Growing |
| **bills** | Billing records | id, order_id, subtotal, gst_percent, gst_amount, service_charge, discount_amount, total, payment_mode, payment_status, bill_number | Growing |
| **payments** | Payment transactions | id, bill_id, mode, amount, reference_number | Growing |
| **refunds** | Refund records | id, bill_id, amount, reason, refund_mode, performed_by | Rare |
| **print_stations** | Printer configuration | id, name, station_type, printer_ip, port, is_active | 5 |
| **print_jobs** | Print queue | id, type, printer_ip, payload, status, error | Transient |
| **audit_logs** | Audit trail | id, action, order_id, bill_id, performed_by, details | Growing |
| **daily_closings** | EOD reconciliation | id, date, total_sales, total_orders, cash/upi/card totals, denomination_details, short_surplus | Daily |
| **settings** | Key-value config | key, value | ~12 |
| **push_subscriptions** | Web Push endpoints | id, user_id, endpoint, p256dh, auth | Per device |

### Key relationships
```
profiles ←── orders.waiter_id
tables ←──── orders.table_id
tables.current_order_id ──→ orders.id  (circular FK)
orders ←──── order_items.order_id
menu_items ←─ order_items.menu_item_id
item_variants ←─ order_items.variant_id
orders ←──── kot_entries.order_id
orders ←──── bills.order_id
bills ←───── payments.bill_id
bills ←───── refunds.bill_id
categories ←─ menu_items.category_id
```

### Fragile / underdesigned areas
1. **`tables.current_order_id` circular FK**: A table points to its "current" order, but a table can have multiple active orders. This was the source of the orphaned order bug (v1.1.0 fix). The field is still used but the dashboard now queries all orders for a table.
2. **No `order_items.variant_name` denormalization**: If a variant is deleted, historical order items lose context. The variant_id FK will break.
3. **`bill_number` is generated at INSERT time**: If two bills are created simultaneously, the `generate_bill_number()` function could produce duplicates (no SERIALIZABLE isolation or advisory lock).
4. **`print_jobs` grows unbounded**: Old jobs are only cleaned by the print proxy on startup (24h+). If the proxy is down for days, the table bloats.
5. **No `orders.billed_at` timestamp**: You can't easily tell when an order was billed vs. when the bill record was created.
6. **`order_items.total_price` is denormalized**: It equals `quantity * unit_price` but is stored separately — can drift if either is updated without recalculating.

---

## 6. API AND ENDPOINT INVENTORY

### Direct Supabase SDK calls (not REST endpoints)
The app does NOT use a traditional REST API layer. All data operations use Supabase client SDK calls directly from client components. This means:
- No request/response validation middleware
- No rate limiting
- No server-side business logic validation (except RLS and DB functions)
- Business logic lives in the browser

### API Routes (Next.js `/api`)

| Endpoint | Method | Auth | Purpose | Risk Level |
|----------|--------|------|---------|-----------|
| `/api/admin/users` | GET | Admin | List users + email map | Low |
| `/api/admin/users` | POST | Admin | Create staff (auth + profile) | Medium |
| `/api/admin/users` | PATCH | Admin | Update staff/password | Medium |
| `/api/admin/users` | DELETE | Admin | Delete staff (cascade) | High |
| `/api/push/subscribe` | POST | Auth'd | Register push subscription | Low |
| `/api/push/subscribe` | DELETE | Auth'd | Remove push subscription | Low |
| `/api/push/send` | POST | Auth'd | Send push to staff | Low |

### Critical data operations (client-side, no API)
| Operation | File | Tables Written | Risk |
|-----------|------|---------------|------|
| Place order | `pos/page.tsx`, `waiter/page.tsx` | orders, order_items, tables, kot_entries, print_jobs | **Critical** |
| Create bill | `cashier/page.tsx` (billing dialog) | bills, payments, audit_logs, print_jobs | **Critical** |
| Settle payment | `cashier/page.tsx` | bills, payments, orders, tables | **Critical** |
| Cancel item | `cashier/page.tsx` | order_items, audit_logs | High |
| Issue refund | `cashier/page.tsx` | refunds, bills, audit_logs | High |
| Close day | `admin/eod/page.tsx` | daily_closings, audit_logs | High |
| Mark KOT ready | `kitchen/page.tsx`, `bar/page.tsx` | kot_entries | Medium |

---

## 7. CORE BUSINESS LOGIC

### Order creation flow
**Files**: `src/app/pos/page.tsx`, `src/app/waiter/page.tsx`

1. Staff selects table (dine-in) or marks as takeaway
2. Browses menu categories → adds items to local cart state
3. Optionally selects variants, adds notes
4. Clicks "Place Order"
5. Guard: `placing` boolean prevents double-submit
6. `generate_order_number()` DB function assigns daily sequential number (#001, #002...)
7. INSERT into `orders` (table_id, waiter_id, order_type, status='pending')
8. INSERT into `order_items` (one per cart item, with station from menu_item)
9. UPDATE `tables` set status='occupied', current_order_id=new_order_id
10. Group items by station → create `kot_entries` per station
11. INSERT `print_jobs` per station (type='kot')
12. Print proxy picks up jobs, formats ESC/POS, sends to printer

### Add items to existing order
1. Cashier/waiter opens existing order
2. Adds new items to cart
3. INSERT new `order_items` for existing order_id
4. New `kot_entries` created (with incremented KOT number)
5. New `print_jobs` for the additional items only

### KOT generation and update flow
1. On order placement, items grouped by `station` field
2. Each station group → one `kot_entries` record with `generate_kot_number(station)`
3. KOT numbers are daily sequential per station: KOT-K-001, KOT-C-001, KOT-M-001
4. Kitchen display subscribes to `kot_entries` changes via Realtime
5. Kitchen staff can mark: pending → preparing → ready
6. When marked ready, broadcast sent via Supabase channel → waiter app receives notification
7. KOTs filtered by business day — old KOTs don't show on displays

### Billing / tax / service charge / GST logic
**All calculated client-side in the billing dialog**

1. **Subtotal** = SUM(order_items.total_price) for non-cancelled items
2. **Service charge** = subtotal × 10% (configurable in settings)
   - Can be waived per order (requires PIN) → sets `orders.service_charge_removed = true`
3. **Taxable amount** = subtotal + service_charge (or just subtotal if SC waived)
4. **GST** = taxable_amount × 5% (configurable in settings)
   - Split as SGST 2.5% + CGST 2.5% on printed bill
5. **Discount** = flat amount or percentage (up to cashier_discount_max_percent without manager override)
   - Discount reason required
6. **Round-off** = round to nearest rupee
7. **Grand total** = subtotal + service_charge + GST - discount ± round-off

### Payment settlement flow
1. Cashier selects payment mode: Cash / UPI / Card / Zomato / NC (No Charge) / Split
2. For split payments: multiple payment records created per mode
3. INSERT into `bills` (subtotal, gst, sc, discount, total, payment_mode, payment_status='paid')
4. INSERT into `payments` (one per payment method in split, or one for single)
5. UPDATE `orders` set status='completed'
6. UPDATE `tables` set status='available', current_order_id=null
7. INSERT `print_jobs` for bill printing
8. INSERT `audit_logs` if NC/partial/etc.

### Refund flow
1. Cashier opens a paid bill
2. Enters refund amount, reason, refund mode (cash/UPI/card)
3. INSERT into `refunds`
4. UPDATE `bills.total_refunded` += refund_amount
5. INSERT `audit_logs` (action='refund')

### Day close / reconciliation
1. Admin/cashier navigates to EOD page
2. System queries all bills for the business day
3. Calculates expected cash = opening_balance + cash_sales - cash_refunds
4. Staff counts physical cash by denomination
5. System calculates short/surplus
6. Staff confirms → INSERT `daily_closings`
7. INSERT `audit_logs` (action='daily_closing')

### Offline handling
**None**. The app requires constant internet connectivity to Supabase. If internet drops:
- Orders cannot be placed
- Bills cannot be generated
- KOTs cannot be printed
- Displays go stale
- No local queue, no retry, no offline cache

---

## 8. GUARDRAILS AND SAFETY CHECKS CURRENTLY PRESENT

### What protections exist

| Protection | Status | Implementation |
|-----------|--------|---------------|
| **Double-tap prevention (order)** | Present | `placing` boolean guard in POS and waiter pages |
| **PIN for sensitive ops** | Present | Security PIN required for: item cancellation, SC removal, NC payment, bill reprint |
| **Audit trail** | Present | `audit_logs` table records: item_cancel, bill_reprint, refund, nc_payment, sc_removal, day_close, partial_payment, balance_collected, table_transfer |
| **Staff attribution** | Present | `performed_by` field on audit_logs, `waiter_id` on orders, `closed_by` on daily_closings |
| **Bill reprint tracking** | Present | `orders.bill_print_count` incremented on each reprint; audit log entry created |
| **Business day boundary** | Present | Configurable day boundary (default 3 AM) prevents mixing days in reports |
| **Multi-order table billing** | Present (v1.1.0) | Billing dialog aggregates ALL active orders for a table, not just current_order_id |
| **KOT business day filter** | Present (v1.2.0) | Kitchen/bar/cafe displays only show today's KOTs |
| **Discount threshold** | Present | `cashier_discount_max_percent` setting limits cashier discounts without manager override |
| **Item cancellation reason** | Present | Cancel reason required + logged in audit |
| **Table uniqueness** | Present | DB unique constraint on (number, section) |
| **Order number uniqueness** | Present | Daily sequential via DB function |

### What's notably absent (see Section 9)
- No server-side total validation
- No idempotency keys on mutations
- No duplicate payment prevention
- No edit protection on paid bills (client-side only)
- No optimistic locking / conflict detection
- No print retry with confirmation
- No permission checks at DB/RLS level for most operations

---

## 9. MISSING GUARDRAILS / OPERATIONAL RISKS

### CRITICAL RISKS

#### 1. No offline resilience
- **Why it matters**: Cafe WiFi or Supabase outage = complete service halt
- **What could happen**: During lunch rush, internet drops for 5 minutes. No orders can be placed, no bills printed. Staff must take manual orders on paper with no way to enter them later
- **Severity**: **CRITICAL**
- **Fix**: Implement local queue (IndexedDB/localStorage) that syncs when connectivity returns. At minimum, show cached menu and queue orders locally

#### 2. Client-side billing math — no server validation
- **Why it matters**: Total, GST, service charge, discount calculations happen in the browser. A modified client or bug could produce incorrect bills
- **What could happen**: A browser glitch calculates wrong GST. Bill is printed with incorrect amount. Customer pays wrong total. EOD reconciliation won't catch it because the DB stores the client-calculated values
- **Severity**: **CRITICAL**
- **Fix**: Add a server-side function (DB function or Edge Function) that recalculates totals from order_items before INSERT into bills. Reject if mismatch

#### 3. No duplicate payment prevention
- **Why it matters**: Nothing prevents a bill from being paid twice
- **What could happen**: Cashier clicks "Pay" but UI is slow. Clicks again. Two payment records created for the same bill. EOD shows double revenue
- **Severity**: **HIGH**
- **Fix**: Add `paying` guard (like the `placing` guard for orders). Add DB constraint: bills with payment_status='paid' cannot accept new payments

#### 4. No idempotency on order placement
- **Why it matters**: If the network is slow and the user taps "Place Order" and the request completes but the UI doesn't update, a refresh could re-place the order
- **What could happen**: Duplicate order created for the same table. Kitchen prints two KOTs for the same items
- **Severity**: **HIGH**
- **Fix**: Generate a client-side idempotency key (UUID) and store it with the order. DB unique constraint on idempotency_key prevents duplicates

#### 5. Print proxy is a single point of failure
- **Why it matters**: One Electron app on one Windows PC handles ALL printing. If it crashes, freezes, or the PC restarts, no KOTs or bills print
- **What could happen**: Kitchen stops receiving orders. Customers don't get bills. Staff don't know items are ordered. Revenue leakage
- **Severity**: **HIGH**
- **Fix**: (a) Add print failure alerting — if print_jobs stay 'pending' for >60s, show alert on cashier dashboard. (b) Add browser-based fallback printing (window.print()). (c) Auto-restart is already implemented in Electron app (max 5 retries)

#### 6. RLS policies are too permissive
- **Why it matters**: Any authenticated user (including waiters) can INSERT audit logs, UPDATE orders to 'completed', UPDATE bills, etc. Role enforcement is client-side only
- **What could happen**: A waiter could use browser dev tools to mark an order as completed without payment, or insert fake audit logs
- **Severity**: **MEDIUM** (requires technical knowledge to exploit)
- **Fix**: Add role-based RLS policies: only cashier/admin can INSERT bills, only cashier/admin can UPDATE orders.status to 'completed', only admin can DELETE anything

### HIGH RISKS

#### 7. No optimistic locking / concurrent edit detection
- **Why it matters**: Two staff members could edit the same order simultaneously
- **What could happen**: Waiter adds items to order. Cashier simultaneously opens billing for same order. Cashier bills incomplete order. Added items not billed
- **Severity**: **HIGH**
- **Fix**: Add `version` column to orders. Check version on UPDATE. Reject if stale

#### 8. No protection against editing paid bills
- **Why it matters**: Once a bill is paid, nothing at the DB level prevents modifying it
- **What could happen**: A paid bill's total could be changed via direct DB access or client manipulation. Audit trail wouldn't catch it
- **Severity**: **MEDIUM**
- **Fix**: Add DB trigger: BEFORE UPDATE on bills, reject if payment_status='paid' (except for refund updates)

#### 9. KOT print failure is silent
- **Why it matters**: If a KOT fails to print, the kitchen never receives the order. The only indication is the print_jobs.status='failed' field, which nobody monitors
- **What could happen**: Customer waits 30 minutes. Kitchen never made the food. Staff blames each other. Customer leaves
- **Severity**: **HIGH**
- **Fix**: Show failed print jobs prominently on cashier dashboard. Add retry button. Add sound alert for failed prints

#### 10. No table state consistency enforcement
- **Why it matters**: Table status (available/occupied) is managed by client-side logic. If the browser closes mid-operation, the table can be stuck in 'occupied' with no order
- **What could happen**: Table shows occupied but has no active order. Staff can't seat customers. Must manually fix in admin
- **Severity**: **MEDIUM**
- **Fix**: Periodic cleanup job: if table is 'occupied' but has no pending/preparing orders, reset to 'available'

---

## 10. RELIABILITY REVIEW

### Failure scenario analysis

| Scenario | Current Behavior | Impact |
|----------|-----------------|--------|
| **Internet drops** | All operations halt immediately. UI shows errors. No fallback | **CRITICAL** — service stops |
| **Supabase unavailable** | Same as internet drop — no local fallback | **CRITICAL** — service stops |
| **Print proxy crashes** | Auto-restart (max 5 attempts). Jobs queue in DB. Resume on restart | **HIGH** — printing delayed, not lost |
| **Printer hardware fails** | Print job marked 'failed'. No automatic fallback printer | **MEDIUM** — can reprint when fixed |
| **Two staff edit same order** | Last write wins. No conflict detection | **HIGH** — data inconsistency |
| **Browser reloads mid-order** | Cart lost (useState only). Order not placed yet = no data loss. Mid-settlement = partial state | **MEDIUM** — user must restart |
| **Payment received but sync fails** | Payment record not created. Cash received but not in system | **HIGH** — revenue tracking gap |
| **Kitchen doesn't receive KOT** | Silent failure. No monitoring dashboard for failed prints | **HIGH** — customer waits indefinitely |
| **Peak-hour rush** | Supabase handles concurrent reads well. Realtime may lag. Print proxy is single-threaded | **MEDIUM** — possible delays |

### Reliability score: **6/10**

### To reach 8/10:
1. Add print failure monitoring + alerts on cashier dashboard
2. Add `paying`/`billing` guards to prevent double payments
3. Add server-side bill total validation (DB function)
4. Add table state cleanup (auto-free orphaned tables)
5. Add basic error recovery UX (retry buttons, clearer error messages)

### To reach 9/10:
1. Implement offline queue with IndexedDB for order placement
2. Add optimistic locking on orders and bills
3. Add role-based RLS policies
4. Add automatic KOT reprint on failure
5. Add health check dashboard for print proxy status
6. Add automated tests for critical billing logic

---

## 11. SECURITY + PERMISSIONS REVIEW

### Current auth design
- **Supabase Auth** with email/password
- Session managed via HTTP-only cookies (via `@supabase/ssr`)
- **Middleware** (`src/middleware.ts`) checks auth on every request; 5-second timeout fallback
- **PIN-based protection** for sensitive operations (stored in `settings` table as plaintext)

### Role-based access
- **UI-level enforcement**: `useAuth(requiredRole)` hook redirects unauthorized users
- **RLS-level enforcement**: Minimal — most policies are `authenticated` (any logged-in user)
- **API-level enforcement**: `/api/admin/users` checks admin role server-side

### Security concerns

| Issue | Severity | Details |
|-------|----------|---------|
| **Security PIN stored as plaintext** | Medium | `settings` table stores PIN as plain text value. Anyone with DB read access sees it |
| **VAPID private key in .env.local** | Low | Normal for Web Push, but ensure it's in .gitignore |
| **Supabase anon key in client bundle** | Low | Expected for Supabase — RLS is the security layer. But RLS is permissive |
| **No service role key in .env.local** | Info | Service role key only in print proxy config and API routes (server-side only) |
| **No CSRF protection** | Low | Supabase Auth cookies handle this via SameSite |
| **No rate limiting** | Medium | No rate limit on login attempts, API calls, or order placement |
| **Client-side role checks only** | Medium | A determined user could bypass UI role checks. RLS doesn't enforce roles for most operations |

### Recommendations
1. Hash the security PIN (bcrypt) before storing
2. Add role-based RLS policies for write operations
3. Add rate limiting on login endpoint
4. Ensure `.env.local` is in `.gitignore` (verify)
5. Add IP allowlisting for admin API routes if possible

---

## 12. UX / OPERATIONAL FLOW REVIEW

### What works well for busy staff
- **Table grid** with color coding — cashier can see status at a glance
- **Waiter mobile app** — purpose-built, minimal taps to place order
- **Kitchen display** — large cards, clear item names, status buttons
- **Sound notifications** — distinct tones for new orders vs. food ready
- **One-tap KOT printing** — order placement auto-prints to correct station
- **Business day boundary** — late-night orders correctly attributed

### Potential confusion during rush hours
- **Live Orders vs. Tables tab**: Staff may miss orders if they're looking at one tab but the order shows in the other. The v1.1.0 fix (aggregated table totals) helps but the dual-view paradigm can still confuse
- **No visual alert for failed prints**: If a KOT fails to print, there's no prominent warning. Kitchen staff won't know to check
- **Variant selection**: If an item has variants, there's no forced selection — staff might accidentally order the base price
- **PIN popup**: During rush, the PIN dialog for cancellations/SC removal can slow down service
- **No "undo" for order placement**: Once placed, can't quickly undo — must cancel individual items with PIN

### Recommended changes for "low training required" operation
1. Add a prominent **red banner** on cashier dashboard when any print job has failed
2. Add **confirmation sound** when order is successfully placed (distinct from notification sounds)
3. Add **quick-reorder** from recent orders for regulars
4. Add **table transfer** button directly on the table card (not buried in menus)
5. Consider **removing the Live Orders tab** and showing all info on the Tables view (user has expressed this preference)

---

## 13. DEPLOYMENT + ENVIRONMENT

### Hosting
- **Frontend**: Vercel (Hobby plan) — auto-deploys from `main` branch on GitHub
- **Database**: Supabase Cloud (free/Pro tier)
- **Print Proxy**: Electron app on a Windows PC at the cafe

### Environment variables
```
# .env.local (required)
NEXT_PUBLIC_SUPABASE_URL=[REDACTED]          # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=[REDACTED]     # Supabase anon/public key
NEXT_PUBLIC_VAPID_PUBLIC_KEY=[REDACTED]      # Web Push VAPID public key
VAPID_PRIVATE_KEY=[REDACTED]                 # Web Push VAPID private key (server-only)
VAPID_SUBJECT=[REDACTED]                     # Web Push contact email

# Required server-side (set in Vercel env vars, NOT in .env.local)
SUPABASE_SERVICE_ROLE_KEY=[REDACTED]         # Supabase service role key
```

### Build/run commands
```bash
npm install          # Install dependencies
npm run dev          # Local dev server (port 3000)
npm run build        # Production build
vercel --prod        # Force deploy to production
```

### Local dev setup
1. Clone repo
2. Copy `.env.local.example` to `.env.local`, fill in Supabase credentials
3. Run migrations in Supabase SQL Editor
4. Create admin user in Supabase Auth dashboard
5. `npm install && npm run dev`

### Print proxy setup
1. Install Node.js on Windows PC
2. Download `LeVantage-PrintProxy-Setup.bat` from GitHub
3. Run setup script (installs Electron app)
4. Configure Supabase URL and service role key
5. App starts in system tray, auto-restarts on crash

### Fragile deployment assumptions
- **Vercel Hobby plan**: Limited to 100GB bandwidth/month. Could be tight with heavy real-time usage
- **Supabase free tier**: Row limits, connection pool limits during rush hours
- **Single print proxy**: No redundancy for printing
- **No staging environment**: Direct deploys to production from `main` branch
- **No migration runner**: Migrations are manually run in SQL Editor

---

## 14. OBSERVABILITY / DEBUGGING

### Existing logging
- **Console logging**: `console.error()` calls throughout for Supabase query errors
- **Audit logs table**: Tracks business-critical actions (not technical errors)
- **Print proxy logs**: Visible in Electron app UI (stdout/stderr captured)
- **Print job status**: `print_jobs.error` field stores failure reasons

### What's missing
- No centralized error tracking (no Sentry, no LogRocket)
- No server-side logging (Vercel function logs exist but not structured)
- No performance monitoring
- No health check endpoint
- No alerting on failures (email/Slack/SMS)
- No database query performance monitoring
- No uptime monitoring for the app or print proxy

### How easy to debug
- **Frontend errors**: Browser dev tools + console.error statements
- **Database errors**: Supabase dashboard → Logs
- **Print errors**: Print proxy Electron UI shows logs + print_jobs.error field
- **Auth errors**: Supabase Auth dashboard → Logs
- **Overall**: Moderate difficulty. No structured logging makes it hard to trace issues across the stack

### Minimum monitoring to add before full production
1. **Sentry** (or equivalent) for frontend error tracking
2. **Uptime monitor** for Vercel app + Supabase
3. **Print job failure alert** on cashier dashboard (high priority)
4. **Supabase connection pool monitoring** (dashboard alerts)

---

## 15. TESTING REVIEW

### Existing tests
**None**. Zero test files. No test framework configured (no Jest, Vitest, Playwright, or Cypress).

### What should be tested first (priority order)
1. **Billing calculation logic**: GST, service charge, discount, round-off, grand total — this is money. Test with edge cases (zero items, 100% discount, NC order, split payment)
2. **Order placement flow**: Verify order_items match cart, KOT entries created correctly, table status updated
3. **Multi-order table billing**: Ensure all orders for a table are included in the bill
4. **Day close reconciliation**: Expected cash calculation accuracy
5. **Business day boundary**: Orders at 2:59 AM vs 3:01 AM assigned to correct day

### Minimum test plan for safe rollout
- [ ] Place 5 dine-in orders across different tables and stations
- [ ] Place 2 takeaway orders
- [ ] Verify KOTs print to correct stations
- [ ] Add items to an existing order — verify supplementary KOT prints
- [ ] Bill a single-order table — verify total matches manual calculation
- [ ] Bill a multi-order table — verify all items included
- [ ] Test each payment mode (cash, UPI, card, Zomato, NC, split)
- [ ] Cancel an item — verify audit log and updated total
- [ ] Remove service charge — verify PIN prompt and updated total
- [ ] Issue a refund — verify audit log and bill.total_refunded
- [ ] Run day close — verify cash reconciliation math
- [ ] Check reports match day close numbers
- [ ] Check Hawk Eye shows all audit actions
- [ ] Test with printer offline — verify print_jobs.status='failed'
- [ ] Test with slow internet — verify no duplicate orders

---

## 16. PARALLEL-RUN READINESS

### Metrics to compare between Le Vantage POS and Pet Pooja
| Metric | How to Compare |
|--------|---------------|
| **Total daily sales** | Compare grand totals at EOD |
| **Order count** | Count of orders per day |
| **Payment breakdown** | Cash / UPI / Card totals should match |
| **Item-wise sales** | Compare item quantity reports |
| **GST collected** | Compare tax totals |
| **Service charge** | Compare SC collected/waived |
| **Discount given** | Compare discount totals |
| **Refunds** | Compare refund count and total |

### Red flags (mismatches that need investigation)
- Sales total difference > ₹100 on any day
- Order count difference > 2 on any day
- Any payment mode total difference > ₹50
- Missing orders in one system but not the other
- KOT printed in one system but not the other

### Daily manual checks
1. Compare EOD total sales between both systems
2. Compare cash counted vs. expected in both systems
3. Spot-check 3-5 random bills for amount accuracy
4. Verify all tables are properly freed at end of day
5. Check for any failed print jobs in the system

### What must be proven before full switchover
1. 7 consecutive days with <₹50 daily sales variance
2. Zero lost orders (every order in Pet Pooja has a match in Le Vantage)
3. Zero billing errors (spot-checked daily)
4. Print reliability >99% (less than 1 failed print per 100)
5. Staff comfortable with all workflows (no training gaps)
6. Day close reconciliation matches within ₹10 for 5 consecutive days
7. All edge cases tested: NC orders, refunds, split payments, table transfers

---

## 17. CODE QUALITY REVIEW

### Overall maintainability: **7/10**
- Code is well-organized with clear file structure
- TypeScript provides type safety
- shadcn/ui components are consistent
- Business logic is readable (not overly abstracted)

### Technical debt
| Area | Debt | Impact |
|------|------|--------|
| **Page files are monolithic** | `cashier/page.tsx`, `pos/page.tsx` are 800+ lines each with all logic inline | Hard to test, hard to refactor |
| **No shared billing calculation module** | Billing math is duplicated across POS, cashier, and billing dialog | Risk of calculation drift |
| **No shared order placement module** | Order creation logic duplicated in POS and waiter pages | Risk of divergence |
| **`tables.current_order_id` still used** | Legacy field that caused bugs; still referenced in some places | Potential for regression |
| **Hardcoded station names** | 'kitchen', 'cafe', 'mocktail', 'juice_bar' appear as string literals throughout | Fragile if stations change |

### Code smells
- **Large `useCallback` functions** doing DB queries + business logic + state updates in one block
- **Inline Supabase queries** in every component (no data layer abstraction)
- **Mixed concerns**: UI rendering, data fetching, and business logic in the same component
- **Some TypeScript `as unknown as`** casts to handle Supabase query types

### Dead code
- `item_addons` and `order_item_addons` tables exist but add-on UI is minimal/unused in some pages
- `juice_bar` station exists in types but is deactivated and rerouted
- Migration 021 (anon RLS for bar display) is commented out / not fully applied

### Refactor priorities
1. Extract billing calculation into a shared utility (`lib/utils/billing.ts`)
2. Extract order placement into a shared utility (`lib/utils/order.ts`)
3. Break monolithic page components into smaller components with custom hooks
4. Create a data access layer (DAL) that wraps Supabase queries

---

## 18. FEATURE INVENTORY

| Feature | Status | Notes |
|---------|--------|-------|
| Email/password authentication | **Complete** | Works well |
| Role-based access control (UI) | **Complete** | Admin, Manager, Accountant, Cashier, Waiter |
| Menu management (CRUD) | **Complete** | Categories, items, variants |
| Menu CSV export | **Complete** | v1.2.0 |
| Table management | **Complete** | 5 sections, bulk add |
| Staff management | **Complete** | Create, edit, delete, toggle active |
| Order placement (POS) | **Complete** | Full menu grid + cart |
| Order placement (Waiter mobile) | **Complete** | Mobile-optimized |
| Add items to existing order | **Complete** | Supplementary KOT |
| KOT printing (multi-station) | **Complete** | Kitchen, cafe, bar, billing |
| Kitchen Display System | **Complete** | Real-time, station filter, mark ready |
| Bar Display | **Complete** | Dedicated login, ring button |
| Cafe Display | **Complete** | Business day filter, audio keep-alive |
| Billing (GST + SC + discount) | **Complete** | Client-side calculation |
| Multiple payment modes | **Complete** | Cash, UPI, Card, Zomato, NC, Split |
| Bill printing | **Complete** | ESC/POS to Epson thermal |
| Refunds | **Complete** | With audit trail |
| Audit trail (Hawk Eye) | **Complete** | Cancels, reprints, refunds, EOD |
| Day close / EOD | **Complete** | Cash denomination, reconciliation |
| Reports (item, master, waiter, payment) | **Complete** | With CSV export |
| Business day boundary | **Complete** | Configurable 0-5 AM |
| Public QR menu | **Complete** | Read-only, no auth required |
| Push notifications (waiter) | **Complete** | Web Push API + VAPID |
| Audio notifications | **Complete** | Web Audio API (no files needed) |
| Print proxy (Electron) | **Complete** | Auto-restart, auto-update, tray icon |
| Table transfer | **Complete** | Move order between tables |
| Multi-order table billing | **Complete** | v1.1.0 guardrail |
| Inventory management | **Stubbed** | Not implemented |
| Offline support | **Missing** | No offline capability |
| Multi-branch support | **Missing** | Single-location only |
| Customer management / loyalty | **Missing** | No customer records |
| Reservation system | **Missing** | Table status supports 'reserved' but no booking flow |
| Takeaway order queue | **Partial** | Orders created but no dedicated queue view |
| Item modifiers (complex) | **Partial** | Variants yes, modifier groups no |
| Kitchen item transfer between stations | **Partial** | Audit action exists but flow is basic |

---

## 19. TOP PRIORITY UPGRADE LIST

### P0 — Critical fixes before sole POS use
1. **Add print failure monitoring** — Show failed print_jobs on cashier dashboard with retry button
2. **Add `paying` guard** — Prevent double payment submissions (like the `placing` guard for orders)
3. **Server-side bill validation** — DB function to verify bill totals match order_items
4. **Add basic error recovery** — Show retry buttons on failed Supabase operations instead of silent failures

### P1 — Important reliability improvements
5. **Add optimistic locking** — `version` column on orders to detect concurrent edits
6. **Tighten RLS policies** — Role-based write restrictions (cashier-only for bills, admin-only for deletes)
7. **Add table state cleanup** — Auto-free tables that are 'occupied' with no active orders
8. **Add print job monitoring** — Alert when print proxy appears down (stale pending jobs)
9. **Extract billing calculation** — Shared module used by both UI and server-side validation

### P2 — Nice-to-have improvements
10. **Offline order queue** — Cache orders in IndexedDB when internet is down
11. **Centralized error tracking** — Sentry or similar for frontend errors
12. **Uptime monitoring** — Ping check for Vercel app + Supabase + print proxy
13. **Browser-based print fallback** — window.print() when print proxy is down
14. **Consolidate Tables + Live Orders views** — Per user feedback, show all info on table view

### P3 — Refactors for maintainability
15. **Extract order placement logic** — Shared module for POS + waiter
16. **Break down monolithic pages** — Split 800+ line page files into components
17. **Create data access layer** — Wrap Supabase queries in typed functions
18. **Add automated tests** — At minimum: billing math, order flow, business day logic

---

## 20. "START HERE" GUIDE FOR ANOTHER ENGINEER

### First files to read (in order)
1. `src/types/database.ts` — All TypeScript interfaces; maps 1:1 to DB schema
2. `src/lib/constants.ts` — Sections, stations, payment modes, order statuses
3. `supabase/migrations/001_initial_schema.sql` — Core DB schema with all tables, RLS, functions
4. `src/lib/utils/print.ts` — Print flow architecture (KOT + bill printing)
5. `src/app/pos/page.tsx` — Core POS: order placement, cart, table selection
6. `src/app/cashier/page.tsx` — Cashier dashboard: tables, billing, settlement
7. `src/lib/utils/business-day.ts` — Business day boundary logic
8. `src/hooks/use-auth.ts` — Auth flow and role-based access
9. `src/middleware.ts` — Auth gateway for all routes
10. `print-server/index.js` — Print proxy: Supabase Realtime → ESC/POS → TCP

### Most critical flows to understand
1. **Order placement** → how items get from cart to DB to printer
2. **Billing calculation** → how subtotal/GST/SC/discount/total are computed
3. **KOT routing** → how items route to the correct printer station
4. **Business day boundary** → how 3 AM cutoff affects reports, displays, and EOD
5. **Multi-order table billing** → how multiple orders on one table are aggregated

### Most dangerous areas — do NOT change casually
1. **Billing math** in cashier/billing dialog — any change affects real money
2. **`generate_bill_number()`** DB function — affects bill numbering
3. **`generate_order_number()`** DB function — affects order numbering
4. **Print payload formatting** in `print-server/index.js` — affects physical receipts
5. **RLS policies** — loosening them opens security holes; tightening them can break features
6. **Middleware auth checks** — changing public routes can expose protected pages
7. **Table status management** — incorrect status transitions cause orphaned tables

### Safest first improvements to make
1. Add CSS/UI polish (colors, spacing, responsive fixes) — zero business logic risk
2. Add the print failure banner on cashier dashboard — read-only query, high value
3. Add `paying` boolean guard to billing — simple copy of existing `placing` pattern
4. Add automated tests for billing math — doesn't change production code
5. Extract billing calculation into a shared module — refactor, no behavior change

---

## A. CRITICAL RISKS SUMMARY

- **No offline support** — internet outage = complete service halt
- **Client-side billing math with no server validation** — incorrect bills possible
- **No duplicate payment prevention** — double-click can create double payment
- **Silent KOT print failures** — kitchen may never receive orders
- **Permissive RLS** — any authenticated user can modify most data
- **No automated tests** — billing logic untested by code
- **Single print proxy** — hardware failure stops all printing
- **No idempotency on mutations** — network retries can create duplicates

---

## B. PROJECT SNAPSHOT

**Le Vantage POS** is a custom-built cafe Point-of-Sale system for a 78-table restaurant, replacing Pet Pooja. Built with Next.js 16 + Supabase + Tailwind/shadcn, it covers the full order lifecycle: waiter takes orders on phone → KOTs auto-print to kitchen/cafe/bar stations → kitchen display shows live orders → cashier bills with GST/SC → payment recorded → day closed with cash reconciliation.

The system is **pilot-ready** (running in parallel since March 2026) with a **reliability score of 6/10**. Core workflows work well. The biggest gaps are: no offline support, no server-side bill validation, no automated tests, and silent print failures. The codebase is ~16,300 lines of TypeScript across 22 DB tables, 12 pages, 3 API routes, and an Electron print proxy.

To become the **sole POS** safely, the system needs: print failure monitoring, double-payment prevention, server-side total validation, and basic automated tests for billing math. These are estimated at 2-3 days of focused engineering work.

---

## C. QUESTIONS AN ENGINEER SHOULD ASK BEFORE UPGRADING

1. **Is Pet Pooja still running in parallel?** If yes, changes to billing logic need to be validated against both systems
2. **What is the Supabase plan?** Free tier has row limits and connection pool limits that could fail under load
3. **Is the print proxy currently running and stable?** Get access to the Windows PC running it
4. **What is the current daily order volume?** Affects performance and Supabase connection pooling
5. **Are there any RLS policies that were manually modified in the Supabase dashboard** (not in migration files)?
6. **Is the SUPABASE_SERVICE_ROLE_KEY set in Vercel environment variables?** The `/api/admin/users` route needs it
7. **Are there any other devices (tablets, displays) that access the system besides the ones documented?**
8. **Has the day_boundary_hour setting been changed from the default 3?** This affects all date-range queries
9. **Is anyone using the public QR menu (`/menu`) in production?** It has no auth — changes to menu_items are immediately visible
10. **What's the WiFi reliability at the cafe?** This is the single biggest risk factor for the system
11. **Are there plans to add more printer stations or change printer IPs?** The print proxy hardcodes the Supabase Realtime filter
12. **Is the cafe open past midnight?** If yes, the business day boundary is critical and must not be broken

---

## E. SENSITIVE CONFIGURATION

The following environment variables are required but must NEVER be committed to the repository. Values are stored in `.env.local` (local dev) and Vercel environment settings (production).

| Variable | Scope | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Supabase anonymous/public API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only (Vercel) | Supabase admin key — bypasses RLS |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Client + Server | Web Push VAPID public key |
| `VAPID_PRIVATE_KEY` | Server only | Web Push VAPID private key |
| `VAPID_SUBJECT` | Server only | Web Push contact email (mailto: URI) |

Additionally, the following are configured in the database `settings` table (not env vars):
- `security_pin` — PIN for sensitive operations (cancellations, reprints, SC removal)
- Printer IP addresses — configured in `print_stations` table

**The print proxy** (`print-server/`) requires its own Supabase credentials configured locally on the Windows PC running it.

---

## F. JSON SUMMARY

```json
{
  "project_name": "Le Vantage POS",
  "frontend_stack": ["Next.js 16.1.6", "React 19.2.3", "Tailwind CSS 4", "shadcn/ui 4", "TypeScript 5"],
  "backend_stack": ["Supabase (PostgreSQL + Auth + Realtime)", "Next.js API Routes", "Web Push (VAPID)"],
  "database": ["PostgreSQL via Supabase Cloud", "22 tables", "RLS policies", "DB functions (order/bill/KOT number generators)", "No ORM"],
  "deployment": ["Vercel (Hobby plan)", "Supabase Cloud", "Electron print proxy on Windows PC", "GitHub auto-deploy on push to main"],
  "key_modules": [
    "src/app/pos/page.tsx — POS order placement",
    "src/app/cashier/page.tsx — Cashier dashboard + billing",
    "src/app/waiter/page.tsx — Mobile waiter app",
    "src/app/kitchen/page.tsx — Kitchen display system",
    "src/app/bar/page.tsx — Bar display",
    "src/app/cafe/page.tsx — Cafe display",
    "src/app/admin/ — Admin panel (10 sub-pages)",
    "src/lib/utils/print.ts — Print/KOT utilities",
    "src/lib/utils/business-day.ts — Business day logic",
    "src/hooks/use-auth.ts — Auth + role-based access",
    "print-server/index.js — Print proxy (Realtime → ESC/POS → TCP)"
  ],
  "core_workflows": [
    "Order placement (POS + Waiter)",
    "KOT printing (multi-station auto-routing)",
    "Kitchen/Bar/Cafe display (real-time)",
    "Billing (GST + SC + discount)",
    "Payment settlement (cash/UPI/card/Zomato/NC/split)",
    "Day close / EOD reconciliation",
    "Reporting (item, master, waiter, payment)",
    "Audit trail (Hawk Eye)"
  ],
  "roles": ["admin", "manager", "accountant", "cashier", "waiter"],
  "critical_risks": [
    "No offline support — internet outage halts all operations",
    "Client-side billing math — no server-side validation",
    "No duplicate payment prevention",
    "Silent KOT print failures — kitchen may not receive orders",
    "Permissive RLS — role enforcement is UI-only",
    "No automated tests",
    "Single print proxy — hardware failure stops all printing"
  ],
  "missing_guardrails": [
    "Server-side bill total validation",
    "Duplicate payment prevention (paying guard)",
    "Idempotency keys on order placement",
    "Optimistic locking for concurrent edits",
    "Print failure alerting on dashboard",
    "Role-based RLS write restrictions",
    "Table state cleanup for orphaned occupied tables",
    "Protection against editing paid bills at DB level"
  ],
  "priority_fixes": [
    "P0: Print failure monitoring + retry on cashier dashboard",
    "P0: Double-payment prevention (paying guard)",
    "P0: Server-side bill total validation",
    "P1: Optimistic locking on orders",
    "P1: Tighten RLS policies by role",
    "P1: Table state cleanup automation",
    "P2: Offline order queue (IndexedDB)",
    "P2: Centralized error tracking (Sentry)",
    "P3: Extract billing/order logic into shared modules",
    "P3: Automated tests for billing math"
  ],
  "reliability_score": "6/10",
  "production_readiness": "Pilot-ready with caveats — needs P0 fixes before becoming sole POS",
  "notes": [
    "Currently running in parallel with Pet Pooja for validation",
    "Menu imported from Pet Pooja (migration 003)",
    "78 tables across 5 sections",
    "4 active Epson thermal printers on LAN",
    "Business day boundary configurable (default 3 AM)",
    "GST flat 5% on all items",
    "Service charge flat 10% (can be waived with PIN)",
    "Version 1.2.0 as of 2026-03-21"
  ]
}
```
