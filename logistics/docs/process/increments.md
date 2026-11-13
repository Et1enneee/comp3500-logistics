# Increment definitions

| Increment and date | Trigger | Outcome |
|---|---|---|
| Planning, 9 and 11 Oct 2026 | Project selected | Scope, responsibilities and contracts recorded ([increment register](increments.md)) |
| 17 Oct 2026 test-led review | Order and stock functions complete in development | Defects recorded in the [increment register](increments.md); led to the confirmation transaction (§5) |
| Confirmation, 26–28 Oct 2026 | Review found a failing confirmation endpoint and a missing stock ledger | Transaction verified ([orders tests](../../tests/orders.integration.ts)) |
| Integrated application, 1 Nov 2026 | All four role workflows runnable together | All four role workflows verified in the 11 Nov regression, driver operations included ([browser checks](../../evidence/test-logs/2026-11-11-browser/browser.log)) |
| Driver and privacy, 2 Nov 2026 | Driver workflow and data minimisation outstanding | Driver assignment and data-minimisation checks pass ([tests](../../tests/privacy.integration.ts)) |
| Documentation hardening, 10–11 Nov 2026 | Review found diagrams and traceability diverging from the implementation | Diagrams and traceability aligned ([traceability](../traceability.md)) |
| Export simplification, 11 Nov 2026 | Admin export took four interactions ([issue #15](https://github.com/Et1enneee/comp3500-logistics/issues/15)) | Selected-date CSV export in three actions; regression passed |
| Availability tests, 11–12 Nov 2026 | CI health checks had no regression test | Two regression tests added; suite reached 38 ([unit.log](../../evidence/test-logs/2026-11-12-regression/unit.log)) |
