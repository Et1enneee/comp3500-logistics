# Group 42 · Logistics Management Application v0.4.2

`logistics-foundation/` is the sole application in this repository: on the accepted v0.3.1 foundation it adds real login and authorization, a customer order center, a staff fulfillment workbench, cancellation with stock release, inventory/alerts/ledger, in-app notifications, a simulated driver assignment and delivery workflow, and ADMIN read-only reports with CSV export.

Local teaching demo, **not for production use**: logistics is simulated locally (labeled in the UI); no real carrier or payment is integrated.

## What This Package Can Do

- `/login`: real session login (scrypt password hashing, HttpOnly cookie, CSRF, login rate limiting). The legacy `X-Demo-User-Email` header no longer has any authentication or authorization effect.
- `/` (customer): database-backed product catalog, integer quantities, live estimated total, order placement; `/orders` my orders (status filter, pagination, lookup by ORD); `/orders/{id}` details, shipment timeline, cancellation; `/notifications` notification center (unread count, mark as read).
- `/staff` (staff): order queue (status filter, pagination, exact lookup by ORD); `/staff/orders/{id}` confirm / pick / ship (single LG shipment) / simulate pickup / simulate delivery / cancel CONFIRMED; `/inventory` inventory, low-stock alerts, replenishment, stock ledger.
- `/driver` (driver): view only assigned orders; simulate pickup and delivery. Staff assign a driver after shipping and before pickup.
- `/admin` (admin, read-only): order count, status distribution, delivered amount, non-cancelled amount, currently low-stock SKUs, GMT+8 date range, CSV export; the inventory page is read-only.
- API: `/api/v1/auth/*`, `/api/v1/orders` (create/list/lookup by ORD), `/api/v1/orders/{id}`, `/api/v1/orders/{id}/status`, `/api/v1/orders/{id}/tracking`, `/api/v1/shipments`, `/api/v1/inventory*`, `/api/v1/notifications*`, `/api/v1/reports/overview`, `/api/v1/reports/export.csv`.

## 1. Fresh-Directory Installation (Node 24; local verification on 24.22.1)

```bash
npm ci
npm run db:setup      # prisma generate + migrate deploy (migrations preserve existing data)
```

Rebuild demo data **only in a brand-new or disposable demo database** (seed has an explicit confirmation gate and wipes that database):

macOS / Linux:
```bash
RESET_DEMO_DATA=YES npm run db:seed:demo
```
Windows PowerShell:
```powershell
$env:RESET_DEMO_DATA="YES"
npm run db:seed:demo
Remove-Item Env:RESET_DEMO_DATA
```

The seed creates 2 customers + 1 staff + 1 driver + 1 admin, 10 SKUs (SKU007 stock 4 / threshold 5), 56 orders covering all statuses and both cancellation paths, real shipments/tracking events/stock ledger entries/in-app notifications, and prints the demo accounts. The password is configured via `DEMO_PASSWORD`, defaults to `Demo1234!`, and is stored as a scrypt hash.

For an existing local demo database, first run `npm run db:setup`, then create only the driver account without wiping the database:

```bash
CREATE_DEMO_DRIVER=YES npm run db:driver-demo
```

On PowerShell, set `$env:CREATE_DEMO_DRIVER="YES"`, run `npm run db:driver-demo`, then remove the environment variable. This adds only `driver@demo.com` if absent; it does not change an existing account or reset data. `DEMO_PASSWORD` controls the new account password. Use this only on a local demo database.

Start:

```bash
npm run dev:local     # http://127.0.0.1:3000
# or a production build
npm run build && npm run start -- --hostname 127.0.0.1 --port 3100
```

> If your shell sets `RUST_LOG`, the Prisma CLI reports an empty `Schema engine error` when the database file does not exist yet (its log parsing treats the first line as a banner). Run `unset RUST_LOG` before Prisma commands, or `touch prisma/dev.db` first. CI does not set this variable.

Use fictional delivery addresses only: addresses are stored as plain text in the local demo database. Newly created orders require a 1–200 character address; the owning customer and assigned driver can view it, while staff order views and APIs omit it. Old migrated orders retain an empty address and are marked as such; no address is invented.

## 2. Implemented Business Rules (for code tracing)

- Order placement only checks available stock and creates `CREATED`; it does not deduct stock or write ledger entries (`lib/create-order.ts`).
- Confirmation is the authoritative check: within one transaction it conditionally updates the status, conditionally deducts per aggregated SKU, writes one negative `ORDER_CONFIRM` ledger entry per SKU, and writes a notification; any failure rolls back the whole transaction (`lib/order-api.ts`).
- Cancellation: `CREATED → CANCELLED` leaves stock untouched; `CONFIRMED → CANCELLED` restores stock and writes a positive `ORDER_CANCEL_RELEASE` ledger entry, released only once; `PICKING` and later reject with 409.
- Shipping: `PICKING → SHIPPED` is a conditional transition; the same transaction generates the unique `LG-YYYYMMDD-XXXXXX` shipment, its initial event, and a notification; duplicate/concurrent attempts still yield only one shipment (`lib/shipment-api.ts`).
- Driver: staff assign a shipped order to a driver; only that driver may use driver actions for pickup/delivery. Reassignment is locked after pickup. Staff retains the existing simulated pickup/delivery fallback; there is no real GPS, scanner or recipient phone (`lib/driver-api.ts`, `docs/driver-module.md`).
- Inventory: `stock` always means available stock; replenishment only increments and writes a `STOCK_REPLENISH` ledger entry with the operator; alerts require strictly `stock < threshold` (`lib/inventory-api.ts`).
- Reports: orders are attributed to GMT+8 calendar days by `createdAt` (start day inclusive, the day after the end date at 00:00 exclusive); amounts are called "order amounts"; CSV is protected against formula injection (`lib/reports-api.ts`).
- Query parameters: pages and API share validation; illegal status values, decimal quantities, or duplicate page parameters return recoverable UI messages / API 400. Order placement keeps the `SKU_NOT_FOUND_<sku>` and `INSUFFICIENT_STOCK_<sku>` error codes; malformed session cookies are treated as invalid.
- Identity: `401` when not logged in, `403` on role mismatch/CSRF failure, and a uniform `404` for cross-customer objects (`lib/http.ts`, `lib/order-api.ts`). Staff order lists/details omit customer identity and customer ID; customer actors in inventory logs are shown without identifying details. Order numbers identify orders but do not replace login.

## 3. Checks and Evidence

```bash
npm run typecheck
npm test
npm run test:integration
npm run test:delivery
npm run lint
npm run build
# browser acceptance (build + start + fresh seed first):
FOUNDATION_BROWSER_TEST=YES FOUNDATION_BASE_URL=http://127.0.0.1:3100 npm run test:browser
```

Fully isolated evidence (can be run from the repository root or the application directory):

```bash
npm run baseline
RESET_DEMO_DATA=YES npm run evidence
```

The caller must confirm explicitly; the script copies the source to a separate temporary directory, installs locked dependencies, migrates and seeds a temporary database, runs test/build/performance/browser/restart checks, and deletes the copy afterwards. **The original project database is not involved in this flow.** Output defaults to `../evidence/` and can be redirected with `EVIDENCE_ROOT`; without confirmation it exits before any side effect. The source manifest and packaging share `scripts/source-files.mjs`, which excludes databases, real environment variables, dependencies, build/compile caches, and run evidence; packaging re-verifies the manifest and refuses to deliver on mismatch.

The browser script outputs PNGs and `browser-results.json` (default `docs/evidence/`, redirectable with `EVIDENCE_DIR`); it never fakes UI screenshots during tests.

## 4. Directory Layout

```
app/                pages and App Router routes (api/v1/* are the backend endpoints)
components/ui.tsx   shared display components (status badges, pagination, empty states)
lib/                business functions (orders, status, shipping, inventory, notifications, reports, auth, HTTP, time)
prisma/             schema, four migrations, seed
tests/              real-SQLite integration tests (each file gets its own temporary database)
scripts/            browser acceptance
docs/               contracts, traceability, known limitations, and historical evidence
```

## 5. Known Limitations

- SQLite single-writer model: concurrent write conflicts return 503; enterprise-grade throughput is not promised.
- Report inventory metrics are a "current snapshot" and are not filtered by order date (labeled in the UI).
- The full audit on 2026-11-01 shows 3 high + 16 moderate; `npm audit --omit=dev` still shows 3 high. The Prisma/deepmerge-ts chain remains in the non-dev install scope and cannot be considered risk-free for the runtime; the moderate findings come from the ESLint/minimatch chain. Raw JSON, scan scope, and limitations are in `docs/known-issues.md`; no forced breaking upgrade this round.
- Not implemented: public registration, password recovery, OAuth/MFA, real payments, real carrier APIs, email/SMS/push, multiple warehouses, returns and refunds.
