# Current Test and Evidence Plan

## Automated Verification
Run in the logistics-foundation directory (or use the same-named npm commands at the repository root), Node 24, after npm ci and db:setup; seed is only for a brand-new/disposable demo database.

```bash
npm run typecheck
npm test
npm run test:integration
npm run lint
npm run build
```
Current baseline expectations: unit 9, integration 39 (including 3 top-level); new execution results must be recorded as they are.

## Browser System Acceptance (mutates the demo database)
1. Confirm the current prisma/dev.db is fresh/disposable; run seed explicitly with RESET_DEMO_DATA=YES.
2. `npx playwright install chromium` (Linux CI uses --with-deps).
3. `mkdir -p docs/evidence`, then after building start on the loopback address: `npm run start -- --hostname 127.0.0.1 --port 3100`.
4. In another terminal: `FOUNDATION_BROWSER_TEST=YES FOUNDATION_BASE_URL=http://127.0.0.1:3100 npm run test:browser`.
5. If using the system Chromium, also set CHROMIUM_PATH. Expect 16 checks; keep actual output and do not delete assertions.

Integration tests use temporary SQLite, separate from the project demo database. browser is UI/API/DB system verification and does not claim an independent component test suite. There is no current formal report for performance/availability/manual walkthroughs.

## CI
The repository-root .github/workflows/ci.yml runs file checks, install, a one-off database init, types, unit, integration, lint, build, and browser in the logistics-foundation working directory. Actual Actions results are keyed to the corresponding commit; failed runs keep logs, and CI must not be marked passing based on local results.
Historical branch-specific test cases and defect records remain in docs/process/Jaden-*; the original attributions/results represent only the old environment.


---

## v0.4.0 Status (supersedes the counts above)

```bash
npm run typecheck          # tsc --noEmit
npm test                   # 31 unit tests (state machine, GMT+8, scrypt, Cookie/CSRF, rate limiting)
npm run test:integration   # 102 real-SQLite tests, 8 files each with its own temporary database
npm run verify:migration   # legacy database keeps data + demo hashes invalidated + reset tool
npm run lint
npm run build
```

Browser acceptance (real login, four roles, 21 checks):

1. `RESET_DEMO_DATA=YES npm run db:seed:demo` (disposable database only)
2. `npm run build && npm run start -- --hostname 127.0.0.1 --port 3100`
3. `FOUNDATION_BROWSER_TEST=YES FOUNDATION_BASE_URL=http://127.0.0.1:3100 EVIDENCE_DIR=../evidence/screenshots npm run test:browser`

Coverage: customer A logs in → places an order → detail page shows no shipment → customer B cannot read it via direct URL/ORD/API → staff queue filter/ORD lookup → confirm (stock and ledger assertions) → pick → ship (unique LG) → injected tracking-read failure does not false-alarm → delivered (3 ordered events, customer-side timeline) → notification unread count and mark-as-read → ADMIN aggregates reconciled with the DB + CSV → role override 403/401/CSRF → SKU007 cancel-after-confirm restores stock once → replenish 4→5 clears the alert → ledger operator → readable out-of-stock error → 390px four pages without full-page horizontal overflow → dark mode → logout invalidates the session; a write-request network interruption shows "the result of the operation is unknown", and after recovery a refresh shows the real state.

Restart persistence is verified separately by `npm run evidence`: create an order → stop/start the service → the same cookie session, orders, and inventory are all preserved (`evidence/restart-check.json`).

One command generates all evidence (logs, screenshots, performance, audit, results):

```bash
EVIDENCE_ROOT=../evidence npm run evidence
```
