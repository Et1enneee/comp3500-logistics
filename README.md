# Group 42 · Logistics Management System v0.4.2

[![Logistics checks](https://github.com/Et1enneee/comp3500-logistics/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Et1enneee/comp3500-logistics/actions/workflows/ci.yml)

The sole application lives in `logistics-foundation/`; the root directory forwards all run, test, and evidence commands. It keeps the v0.3.1 foundation, Next.js / React / TypeScript / Prisma 6 / SQLite, and the existing lockfile.

## Startup (Node 24; tested on 24.22.1)

From a fresh clone, with network access to install dependencies:

```bash
git clone https://github.com/Et1enneee/comp3500-logistics.git
cd comp3500-logistics
npm run setup
npm run db:setup
# Only for a brand-new or disposable demo database; this command deletes existing data in that database:
RESET_DEMO_DATA=YES npm run db:seed:demo
npm run dev:local
```

Open http://127.0.0.1:3000. Existing databases only run migrations; to upgrade legacy demo passwords use `RESET_PASSWORDS=YES npm run db:reset-passwords`, which preserves orders and inventory. For Windows environment-variable syntax see the application README.

### Demo accounts

After seeding, sign in with one of these accounts:

| Role | Email |
| --- | --- |
| Customer A | `customer.a@demo.com` |
| Customer B | `customer.b@demo.com` |
| Staff | `staff@demo.com` |
| Driver | `driver@demo.com` |
| Admin | `admin@demo.com` |

The default password is `Demo1234!`; setting `DEMO_PASSWORD` before seeding overrides it. These are demo credentials for local use only.

For an existing local demo database, run `npm run db:setup` to apply the migrations, then `CREATE_DEMO_DRIVER=YES npm run db:driver-demo` (macOS/Linux) to create only the driver demo account without wiping data. Existing driver accounts are not changed. On PowerShell set `$env:CREATE_DEMO_DRIVER="YES"` before the command and remove it afterward.

### Try the simulated delivery workflow

Use fictional addresses only; the local SQLite database stores addresses as plain text. Switch accounts by signing out and signing in again.

1. **Customer A:** place a new order with a fictional delivery address. Note the order number. Creating the order does not deduct stock.
2. **Staff:** find that order in the workbench, confirm and pick it, then create the shipment and assign the demo driver. Staff order views do not show the customer's address.
3. **Driver:** open My Deliveries to see the assigned order and its address; simulate pickup and delivery in order.
4. **Customer A:** open the order to review its delivery status and tracking events.

Orders created before the address migration keep an empty address and are marked as not provided; they can still be processed for simulation, but do not represent a real delivery. Staff can also simulate pickup and delivery without a driver assignment for backward compatibility. No GPS, recipient phone or real carrier service is connected. For details and limitations see `logistics-foundation/docs/driver-module.md`.

## Current Capabilities

Real login/logout with persistent sessions and per-customer object isolation; customer catalog, order placement, my orders, shipment tracking, and cancellation; staff confirmation, picking, shipping and driver assignment; drivers update assigned simulated deliveries; a single cancellation after confirmation releases reserved stock; inventory alerts, replenishment, and stock ledger; in-app notifications; ADMIN read-only reports with CSV export. Logistics is simulated locally; there is no real GPS, scanner, payment or carrier integration; the delivery-address field is stored in the local database and is for fictional demo data only. See `logistics-foundation/docs/driver-module.md`.

## Checks and Isolated Evidence

```bash
npm run typecheck
npm test
npm run test:integration
npm run test:delivery
npm run verify:migration
npm run lint
npm run build
# Rebuild the manifest first after source changes, then generate this round's evidence:
npm run baseline
# After explicit confirmation, installs, migrates, and rebuilds a disposable database only in a separate temporary source copy:
RESET_DEMO_DATA=YES npm run evidence
```

`evidence` does not touch the original project database. Output defaults to `evidence/` one level above the application and can be redirected with `EVIDENCE_ROOT`. The lower-level `test:browser` mutates the demo database it connects to; prefer the fully isolated evidence entry point. Service startup, readiness checks, performance and browser checks, restart verification, and service teardown are managed by the evidence pipeline.

The CI workflow is in `.github/workflows/ci.yml`; performance and browser checks share the same service lifecycle. The [reconciliation evidence CI run](https://github.com/Et1enneee/comp3500-logistics/actions/runs/43001010576) passed; the badge links to current main-branch checks.

## Reading Entry Points

- [`docs/final-report.md`](docs/final-report.md): canonical final report and evidence trail.

- `logistics-foundation/README.md`: business rules and detailed run steps.
- [`logistics-foundation/docs/requirements/srs.md`](logistics-foundation/docs/requirements/srs.md): requirements specification.
- `logistics-foundation/docs/known-issues.md`: dependency audit, SQLite, availability, and testing boundaries.
- [`logistics-foundation/docs/contracts/`](logistics-foundation/docs/contracts/) and [`logistics-foundation/docs/traceability.md`](logistics-foundation/docs/traceability.md): interfaces and requirements traceability.
- `logistics-foundation/docs/reference/legacy/`: historical material, not a statement of current capabilities.

The source excludes dependencies, build caches, databases, and real environment variables. `logistics-foundation/SHA256SUMS.txt` lists application files for checksum verification. Historical evidence is kept as historical material; current test evidence is supplied separately. The canonical course report and submission source are maintained in `docs/`; demo materials and official submission records are managed separately by the team.
