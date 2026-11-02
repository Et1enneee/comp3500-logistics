# Group 42 · Logistics Management System v0.4.2

The sole application lives in `logistics-foundation/`; the root directory forwards all run, test, and evidence commands. It keeps the v0.3.1 foundation, Next.js / React / TypeScript / Prisma 6 / SQLite, and the existing lockfile.

## Startup (Node 24; verified this round on 24.22.2)

```bash
npm run setup
npm run db:setup
# Only for a brand-new or disposable demo database; this command deletes existing data in that database:
RESET_DEMO_DATA=YES npm run db:seed:demo
npm run dev:local
```

Open http://127.0.0.1:3000. Existing databases only run migrations; to upgrade legacy demo passwords use `RESET_PASSWORDS=YES npm run db:reset-passwords`, which preserves orders and inventory. For Windows environment-variable syntax see the application README.

## Current Capabilities

Real login/logout with persistent sessions and per-customer object isolation; customer catalog, order placement, my orders, shipment tracking, and cancellation; staff confirmation, picking, shipping, and simulated pickup/delivery; a single cancellation after confirmation releases reserved stock; inventory alerts, replenishment, and stock ledger; in-app notifications; ADMIN read-only reports with CSV export. Default demo accounts and password configuration are documented in the application README. Logistics is simulated locally; there is no real payment or carrier integration.

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

The current CI lives in `.github/workflows/ci.yml`; performance and browser checks share the same service lifecycle. Running it remotely still requires uploading and checking the actual Actions run; the delivery package only claims locally verified results.

## Reading Entry Points

- `logistics-foundation/README.md`: accounts, business rules, and run steps.
- `logistics-foundation/docs/known-issues.md`: dependency audit, SQLite, availability, and testing boundaries.
- `logistics-foundation/docs/contracts/` and `docs/traceability.md`: interfaces and requirements traceability.
- `logistics-foundation/docs/reference/legacy/`: historical material, not a statement of current capabilities.

The delivered source excludes dependencies, build caches, databases, real environment variables, and past evidence; `evidence/results.json`, `delivery.json`, and `SHA256SUMS.txt` in the delivery package are used to verify this round's source and evidence. The course report, demo materials, and official submission records remain managed separately by the team.
