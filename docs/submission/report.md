# COMP 3500SEF · Final Report

**Warehouse Logistics Management System**  
**Group 42:** Tang Yi Jie, Yin Pei Xu, Tang Chao, Yang Ting Zhang, Wu Peng Bo, Chung Ngon Man, Li Mu Qiu.

## 1. Scope

The goals are traceable order decisions and a role-separated workflow. Customers order and track; staff fulfil; drivers deliver; administrators report. Deployment is local-only: one host, all four roles in the same app (§8). Stock checks, confirmation transaction (§5) and role gates (FR-07) guard integrity. All stored data is course demo seed data; no real personal data is processed.

## 2. Development process

An increment is a unit of work closed by a review or a recorded test run; triggers may name the state that demanded the work (checks outstanding, review readiness); a date range spans multi-day work.

**Table A. Increments**

| Increment and date | Trigger | Outcome |
|---|---|---|
| Planning, 9 and 11 Oct 2026 | Coursework kickoff | Scope, responsibilities and contracts — agreed endpoint and data shapes — recorded ([increment register](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/increments.md)) |
| 17 Oct 2026 review | Order and stock functions ready for review | Defects recorded in the [increment register](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/increments.md); led to the confirmation transaction (§5) |
| Confirmation, 26–28 Oct 2026 | Review found a confirmation endpoint that accepted repeat submits and a missing ledger | Transaction verified ([orders tests](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/orders.integration.ts)) |
| Integrated application, 1 Nov 2026 | Order, stock, driver and admin functions complete | Application integrated; all four role workflows runnable end to end |
| Driver and privacy, 2 Nov 2026 | Driver assignment tests and data-minimisation checks outstanding | Driver assignment and data-minimisation checks pass ([tests](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/privacy.integration.ts)) |
| Diagram and traceability review, 10–11 Nov 2026 | Review found diagrams and traceability diverging from the implementation | Diagrams and traceability aligned ([diagram review record](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/diagrams/compliance.md)) |
| Export simplification, 11 Nov 2026 | Admin export took four interactions ([issue #15](https://github.com/Et1enneee/comp3500-logistics/issues/15)) | Selected-date CSV export in three in-app interface interactions; the 11 Nov regression exercised all four role workflows ([browser checks](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/test-logs/2026-11-11-browser/browser.log)) |
| CI health tests, 11–12 Nov 2026 | The record of CI-run outcomes ([observations](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/availability/integration-observations.json)) had no regression test | Two regression tests added; suite reached 38 ([unit.log](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/test-logs/2026-11-12-regression/unit.log)) |

<!-- pagebreak -->

## 3. Requirements

**Functional requirements**

| FR | The system shall | Verification |
|---|---|---|
| FR-01 | create orders with product lines and totals | [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/foundation.integration.ts) |
| FR-02 | enforce lifecycle and stock reservation/release | [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/orders.integration.ts) ([cancel tests](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/cancel.integration.ts)) |
| FR-03 | number orders and shipments and show owner tracking | [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/logistics-chain.integration.ts) |
| FR-04 | show inventory, stock-movement ledger and low-stock alerts; replenishment is recorded as a stock addition by staff | [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/inventory.integration.ts) |
| FR-05 | record notifications for order events and allow reading | [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/notifications.integration.ts) |
| FR-06 | provide admin aggregates and CSV export | [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/reports.integration.ts) |
| FR-07 | authenticate and enforce role/object access | [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/auth.integration.ts) |
| FR-08 | assign shipped orders and record delivery | [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/driver.integration.ts) |

- NFR-01 performance — API p95 ≤2 s, first contentful paint p95 ≤3 s (budgets set in the srs before measurement, unchanged) ([measurement](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/performance.json), §6).
- NFR-02 CI health — green build, test and browser runs, recorded per CI run ([observations](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/availability/integration-observations.json)).
- NFR-03 least privilege — role gates on mutating endpoints; the delivery address is released only to the assigned driver ([privacy tests](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/privacy.integration.ts)).
- NFR-04 interaction budget — at most three in-app interface interactions per core operation (the eleven listed in §8); one interaction is a fill, selection or click; login/navigation are setup ([walkthrough](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/walkthrough/automated-walkthrough.md)).
- NFR-05 process quality — green CI per increment ([observations](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/availability/integration-observations.json)).

**Table B. Risk coverage** ([detailed mapping](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/requirements/risk-coverage.md))

| Risk | Addressed by | Evidence |
|---|---|---|
| RK-01 scheduling slip | [scheduling plan](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/risks.md) | [register](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/increments.md) |
| RK-02 contract rework | Constant tests | [transition tests](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/constants.test.ts) |
| RK-03 test-week capacity | [Traceability](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/traceability.md) | [scope priorities](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/risks.md) |
| RK-04 setup delay | NFR-05 | [CI workflow](https://github.com/Et1enneee/comp3500-logistics/blob/main/.github/workflows/ci.yml) |
| RK-05 demo data | Seed tests | [seed regression test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/seed.integration.ts) |
| RK-06 coursework assignments and test-week squeeze | Weekly re-planning | [risk plan](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/risks.md) |
| RK-07 stack unfamiliarity | Setup guide | [setup guide](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/README.md) |
| RK-08 report and presentation-video deadlines | Weekly re-planning | [risk plan](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/risks.md) |

<!-- pagebreak -->

## 4. System models

The four layers — pages, routes, handlers, Prisma/SQLite persistence (ORM over the SQLite database) — separate interface, application and data concerns. Figures 1–5 answer, in order: what each role can do; how orders transition and stock changes; how entities relate; how the confirmation transaction proceeds; how the layers connect.

Each item references one product; each order has one or more items; each order has at most one shipment; products accumulate ledger entries; notifications relate to at most one order.

![Use cases](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics/docs/closure/usecase.svg)

*Figure 1. Role functions: thirteen use cases grouped under four role actors.* [Source](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/closure/usecase.puml).

<!-- pagebreak -->

![Order lifecycle](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics/docs/diagrams/state-machine.svg)

*Figure 2. Order transitions and stock effects: each transition states its stock effect — reserve, release or none.* [Source](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/diagrams/state-machine.puml).

<!-- pagebreak -->

![Entity relationships](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics/docs/er.svg)

*Figure 3. Data relationships: the multiplicities above, drawn as an ER model.* [Source](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/er.puml).

![Confirmation sequence](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics/docs/diagrams/sequence-diagram.svg)

*Figure 4. Confirmation transaction: session guard, conditional writes, rollback on failure or short stock.* [Source](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/diagrams/sequence-diagram.puml).

<!-- pagebreak -->

![Layered architecture](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics/docs/diagrams/architecture.svg)

*Figure 5. Four layers: role pages call HTTP routes, routes call handlers, handlers use Prisma/SQLite.* [Source](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/diagrams/architecture.puml).

## 5. Implementation

The confirmation transaction (order-api.ts:245–293) reserves stock. Lifecycle: CREATED → CONFIRMED → PICKING → SHIPPED → IN_TRANSIT → DELIVERED; CANCELLED from CREATED or CONFIRMED. Cancellations restock unless the order was CREATED. Staff cancellation is restricted to CONFIRMED.

| Role | State | Effect |
|---|---|---|
| Customer | CREATED | cancel, no restock |
| Customer | CONFIRMED | cancel, restock |
| Staff | CREATED | rejected |
| Staff | CONFIRMED | cancel, restock |
| Customer, staff | PICKING onwards | rejected |

| Design | Implementation | Verification |
|---|---|---|
| Guards: CREATED, sufficient stock | [order-api.ts:250–253](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/order-api.ts#L250-L253), [276–280](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/order-api.ts#L276-L280) | [Orders](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/orders.integration.ts) |
| Confirmation transaction: atomic writes; rollback on insufficient stock; repeats rejected (409) | [order-api.ts:245–293](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/order-api.ts#L245-L293) | [Orders](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/orders.integration.ts) |
| driverId: assign only SHIPPED; kept after delivery | [driver-api.ts:44–51](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/driver-api.ts#L44-L51); [transition](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/order-api.ts#L321-L330) | [Driver](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/driver.integration.ts) |
| FR-03 numbering and tracking | [create-order.ts:91](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/create-order.ts#L91), [shipment-api.ts:62](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/shipment-api.ts#L62) | [Logistics chain](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/logistics-chain.integration.ts) |
| FR-04 | [order-api.ts:281](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/order-api.ts#L281), [398](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/order-api.ts#L398) | [Inventory](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/inventory.integration.ts) |
| FR-05/06/07 handlers | [notify.ts:19](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/notify.ts#L19), [reports-api.ts:105](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/reports-api.ts#L105), [http.ts:58](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/http.ts#L58) — follow the same handler pattern (separate modules) | [Notifications](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/notifications.integration.ts), [Reports](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/reports.integration.ts), [Auth](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/auth.integration.ts) |


<!-- pagebreak -->

## 6. Verification

[CI](https://github.com/Et1enneee/comp3500-logistics/actions/runs/43175733067) records 38 unit and 140 integration checks; 2 integrity checks — evidence-chain checks, not product behaviour: the pipeline refuses to run without an explicit confirmation flag (`RESET_DEMO_DATA=YES`), and the packaged bundle must match the verified source (`SHA256SUMS.txt`) ([integrity checks](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/integrity.check.mjs)); the [integration log](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/test-logs/2026-11-12-regression/integration.log) "tests 140 / pass 140", the [unit.log](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/test-logs/2026-11-12-regression/unit.log) "Tests 38 passed (38)".

Loopback [measurement](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/performance.json) (11 Nov; 30 requests per endpoint across 6 endpoints: orders.list, orders.list.filtered, inventory.list, inventory.logs, notifications.list, reports.overview) gave API p95 3.2–13.6 ms and FCP p95 64–96 ms against 2 s and 3 s targets — loopback only, not representative of public networks or high concurrency.

The reviews also served as static verification ([Table A](§2)).

## 7. Evolution

Three reviews drove the changes: the 17 Oct review found the confirmation defect, fixed by the §5 transaction; the 10–11 Nov review aligned diagrams and traceability with the implementation and replaced the NFR-02 availability window with CI-run checks and scoped NFR-01 measurement to the local loopback; the 11 Nov review added the direct export path ([issue #15](https://github.com/Et1enneee/comp3500-logistics/issues/15)) and two CI-health regression tests (suite 36 → 38). All four fixes remain covered by the recorded suites (§6, §8).

## 8. Validation

The [automated walkthrough](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/walkthrough/automated-walkthrough.md) exercises eleven core operations, each at most three in-app interface interactions. "Browser acceptance passed: 26 checks" — 20 operation checks (5 operations once, 6 twice or thrice), plus 6 cross-cutting checks (mobile viewport, dark scheme, sign-out among them).

## 9. Feedback and reconciliation

**Table C. Feedback to evidence**

| Feedback | Disposition | Source | Evidence |
|---|---|---|---|
| Diagrams diverged from the schema | Models corrected | 10–11 Nov | [Corrections](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/diagrams/compliance.md) |
| Stock effects were recorded under FR-04 | Moved to FR-02 | 17 Oct | [Traceability](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/traceability.md) |
| Early register rows had thin triggers and outcomes | Register rewritten 10–11 Nov; earlier rows in git history | 10–11 Nov | [Register](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/increments.md) · [history](https://github.com/Et1enneee/comp3500-logistics/commits/main/logistics/docs/process/increments.md) |
| The filter-then-export path took four interactions | Combined path not adopted; a direct selected-date export was added (three in-app interface interactions); issue closed | 11 Nov review | [Issue #15](https://github.com/Et1enneee/comp3500-logistics/issues/15) |
| No regression test for CI health | Reached 38 tests | 11 Nov | [Log](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/test-logs/2026-11-12-regression/unit.log) |
| NFR-02 originally set 08:00–24:00 daily availability | Replaced by CI-run checks (§3) — with local-only deployment (§1) there is no hosted environment to measure a daily window; each green run verifies the integration points per commit | 10–11 Nov | [Requirements revision log](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/requirements/srs.md#7-document-control) |
| NFR-01 assumed a hosted measurement model | Scoped to loopback measurement; budgets unchanged (§6) | 10–11 Nov review | [measurement](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/performance.json) |

## 10. Evidence

Baseline record — 38 unit, 140 integration, 2 integrity from the 12 Nov regression run; 26 browser checks ([baseline](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/BASELINE-final-report.json)).

[Traceability](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/traceability.md).
