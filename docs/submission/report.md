# COMP 3500SEF · Final Report

**Warehouse Logistics Management System**  
**Group 42:** Tang Yi Jie, Yin Pei Xu, Tang Chao, Yang Ting Zhang, Wu Peng Bo, Chung Ngon Man, Li Mu Qiu.

## 1. Scope

The goals are traceable order decisions — every state change is recorded, so an order's full history can be audited through ledger entries and notifications — and a role-separated workflow. Customers order and track; staff confirm, pick, ship and assign; drivers record pickup and delivery of their assigned shipments; administrators report. Deployment is local-only. Stock checks, one confirmation transaction (§5) and role gates (FR-07) guard integrity.

## 2. Development process

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
| FR-01 | create orders with one or more items and totals | [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/foundation.integration.ts) |
| FR-02 | enforce lifecycle and stock reservation/release | [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/orders.integration.ts) ([cancel tests](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/cancel.integration.ts)) |
| FR-03 | number orders and shipments and show owner tracking (the staff member or driver currently holding each order) | [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/logistics-chain.integration.ts) |
| FR-04 | show inventory, replenishment, ledger and low-stock alerts | [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/inventory.integration.ts) |
| FR-05 | record notifications for confirm, ship, pickup, delivery and cancel, and allow reading | [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/notifications.integration.ts) |
| FR-06 | provide admin aggregates and CSV export | [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/reports.integration.ts) |
| FR-07 | authenticate and enforce role/object access | [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/auth.integration.ts) |
| FR-08 | assign shipped orders and record delivery | [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/driver.integration.ts) |

Numbering is current: stock effects moved from FR-04 to FR-02 at the 17 Oct review (§9).

- NFR-01 performance — API p95 ≤2 s, first paint ≤3 s ([measurement](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/performance.json), §6).
- NFR-02 CI health — green build, test and browser runs, recorded per CI run (revised from a daily availability window on 10–11 Nov; §9) ([observations](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/availability/integration-observations.json)).
- NFR-03 least privilege — role gates on mutating endpoints; staff ship through order-state changes and the delivery address is released only to the assigned driver ([privacy tests](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/privacy.integration.ts)).
- NFR-04 interaction budget — at most three in-app interface interactions per core operation (the eleven operations listed in §8); non-task steps (login, navigation, waits, assertions, setup) are excluded ([walkthrough](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/walkthrough/automated-walkthrough.md)).
- NFR-05 process quality — green CI runs per increment ([observations](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/availability/integration-observations.json)).

**Table B. Risk coverage** ([detailed mapping](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/requirements/risk-coverage.md))

| Risk | Addressed by | Evidence |
|---|---|---|
| RK-01 scheduling slip | [scheduling plan](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/risks.md) | [increment register](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/increments.md) |
| RK-02 contract rework | Transition table locked by constant tests | [transition tests](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/constants.test.ts) |
| RK-03 test-week capacity | [Traceability](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/traceability.md) | [scope priorities](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/risks.md) |
| RK-04 setup delay | NFR-05 | [CI workflow](https://github.com/Et1enneee/comp3500-logistics/blob/main/.github/workflows/ci.yml) |
| RK-05 demo data | Seed data regression-tested | [seed regression test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/seed.integration.ts) |
| RK-06 coursework assignments and test-week squeeze | Weekly re-planning | [risk plan](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/risks.md) |
| RK-07 stack unfamiliarity | Setup guide and CI | [setup guide](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/README.md) |
| RK-08 report and presentation-video deadlines | Weekly re-planning with video milestones | [risk plan](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/risks.md) |

<!-- pagebreak -->

## 4. System models

The four layers — role pages, HTTP routes, business handlers, Prisma/SQLite persistence (the database layer) — separate interface, application and data concerns. Figures 1–5 answer, in order: role functions; transitions and stock effects; data relationships; the confirmation transaction; layer connections.

![Use cases](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics/docs/closure/usecase.svg)

*Figure 1. Role functions.* [Source](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/closure/usecase.puml).

<!-- pagebreak -->

![Order lifecycle](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics/docs/diagrams/state-machine.svg)

*Figure 2. Order transitions and stock effects.* [Source](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/diagrams/state-machine.puml).

<!-- pagebreak -->

![Entity relationships](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics/docs/er.svg)

*Figure 3. Data relationships.* [Source](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/er.puml).

![Confirmation sequence](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics/docs/diagrams/sequence-diagram.svg)

*Figure 4. Confirmation transaction.* [Source](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/diagrams/sequence-diagram.puml).

<!-- pagebreak -->

![Layered architecture](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics/docs/diagrams/architecture.svg)

*Figure 5. Four layers.* [Source](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/diagrams/architecture.puml).

## 5. Implementation

The confirmation transaction (order-api.ts:245–293) reserves stock. Lifecycle: CREATED → CONFIRMED → PICKING → SHIPPED → IN_TRANSIT → DELIVERED; CANCELLED from CREATED or CONFIRMED. Cancellations restock unless the order was CREATED (stock was never reserved). Staff cancellation is restricted to CONFIRMED; a CREATED order is still the customer's to cancel.

| Role | State | Effect |
|---|---|---|
| Customer | CREATED | cancel, no restock |
| Customer | CONFIRMED | cancel, restock |
| Staff | CONFIRMED | cancel, restock |
| Customer, staff | PICKING onwards | rejected |

| Design | Implementation | Verification |
|---|---|---|
| Guards: CREATED and sufficient stock | [order-api.ts:250–253](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/order-api.ts#L250-L253), [276–280](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/order-api.ts#L276-L280) | [Orders](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/orders.integration.ts) |
| Confirmation transaction: writes state, stock, ledger and notifications atomically; rolls back on insufficient stock; repeats rejected (409) | [order-api.ts:245–293](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/order-api.ts#L245-L293) | [Orders](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/orders.integration.ts) |
| driverId: assign only SHIPPED; retained after delivery | [driver-api.ts:44–51](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/driver-api.ts#L44-L51); [transition](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/order-api.ts#L321-L330) | [Driver](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/driver.integration.ts) |
| FR-03 numbering and tracking | [create-order.ts:91](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/create-order.ts#L91), [shipment-api.ts:62](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/shipment-api.ts#L62) | [Logistics chain](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/logistics-chain.integration.ts) |
| FR-04 ledger | [order-api.ts:281](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/order-api.ts#L281), [398](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/order-api.ts#L398) | [Inventory](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/inventory.integration.ts) |
| FR-05/06/07 handlers | notifications, reports and role gates share one handler pattern | [Notifications](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/notifications.integration.ts), [Reports](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/reports.integration.ts), [Auth](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/auth.integration.ts) |


<!-- pagebreak -->

## 6. Verification

Verification checks requirements against the implementation (§3); validation exercises the delivered workflows (§8). [CI](https://github.com/Et1enneee/comp3500-logistics/actions/runs/43175733067) records 38 unit and 140 integration checks; 2 integrity checks — the pipeline exits unless `RESET_DEMO_DATA=YES`; a packaged copy must reproduce the verified `sourceDigest`; CI also verifies `SHA256SUMS.txt` ([integrity checks](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/integrity.check.mjs)); the [integration log](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/test-logs/2026-11-12-regression/integration.log) shows "tests 140 / pass 140", the [regression log](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/test-logs/2026-11-12-regression/unit.log) "Tests 38 passed (38)".

A loopback [measurement](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/performance.json) (11 Nov; 30 requests per endpoint across 6 endpoints) gave API p95 3.2–13.6 ms and first-contentful-paint p95 64–96 ms against 2 s and 3 s targets.

## 7. Evolution

The 17 Oct review found a confirmation endpoint accepting repeat submissions and a missing ledger; the transaction was retested. The 10–11 Nov review corrected diagrams and traceability and replaced daily availability with CI-run checks. The 11 Nov review added a three-interaction export path ([issue #15](https://github.com/Et1enneee/comp3500-logistics/issues/15)) and two CI-health regression tests raised the suite from 36 to 38 ([unit.log](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/test-logs/2026-11-12-regression/unit.log)).

## 8. Validation

The [automated walkthrough](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/walkthrough/automated-walkthrough.md) (26 browser checks, recorded 11 Nov) exercises eleven core operations, from create order to selected-date export, at most three in-app interface interactions each. Its record ends "Browser acceptance passed: 26 checks" — 20 operation checks across the eleven operations (one to 3 each), plus 6 cross-cutting checks (mobile viewport, dark scheme, sign-out).

## 9. Feedback and reconciliation

**Table C. Feedback to evidence**

| Feedback | Disposition | Source | Evidence |
|---|---|---|---|
| Diagrams diverged from the schema | Models corrected | 10–11 Nov review | [Diagram corrections](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/diagrams/compliance.md) |
| Stock effects were recorded under FR-04 | Moved stock effects to FR-02; current numbering | 17 Oct review | [Traceability](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/traceability.md) |
| Early register rows had thin triggers and outcomes | Register rewritten 10–11 Nov; earlier rows in git history | 10–11 Nov review | [Register](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/increments.md) |
| The filter-then-export path took four interactions | Direct selected-date export path added (three in-app interface interactions); issue closed | 11 Nov automated walkthrough | [Issue #15](https://github.com/Et1enneee/comp3500-logistics/issues/15) |
| CI health record lacked a regression test | Reached 38 tests | 11 Nov regression work | [Test history](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/test-logs/2026-11-12-regression/unit.log) |
| NFR-02 originally required daily availability 08:00–24:00 local time | Replaced by CI-run checks (§3): each green run evidences the integration points continuously; local-deployment budgets recorded (§6) | 10–11 Nov review | [Requirements revision log](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/requirements/srs.md#7-document-control) |

Open: validation sessions with external participants are scheduled 17–24 Nov (§8); a performance re-probe follows on 25 Nov (§6).

## 10. Evidence

[Traceability](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/traceability.md) · [Baseline record](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/BASELINE-final-report.json).
