# COMP 3500SEF · Final Report

**Warehouse Logistics Management System**  
**Group 42:** Tang Yi Jie, Yin Pei Xu, Tang Chao, Yang Ting Zhang, Wu Peng Bo, Chung Ngon Man, Li Mu Qiu.

## 1. Scope

The goals are traceable order decisions — each order's full history is auditable through ledger entries and notifications — and a role-separated workflow. Customers order; staff fulfil; drivers deliver; administrators report. Deployment is local-only: one host, one app (§4). Stock checks, confirmation transaction and role gates guard integrity. All stored data is course demo seed data; no real personal data is processed.

## 2. Development process

An increment is a unit of work closed by a review or a recorded test run.

**Table A. Increments**

| Increment and date | Trigger | Outcome |
|---|---|---|
| Planning, 9–11 Oct 2026 | Coursework kickoff | Scope, responsibilities and contracts — agreed endpoint and data shapes — recorded ([increment register](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/increments.md)) |
| 17 Oct 2026 review | Review of order and stock functions | Defects recorded in the [increment register](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/increments.md); led to the confirmation transaction (§5) |
| Confirmation, 26–28 Oct 2026 | Review found a confirmation endpoint that accepted repeat submits and a missing ledger | Transaction verified ([orders tests](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/orders.integration.ts)) |
| Integrated application, 1 Nov 2026 | Integration of order, stock, driver and admin functions | Application integrated; all four role workflows runnable end to end |
| Driver and privacy, 2 Nov 2026 | Coverage extended to driver assignment and data minimisation | Driver assignment and data-minimisation checks pass ([tests](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/privacy.integration.ts)) |
| Diagram and traceability review, 10–11 Nov 2026 | Review found diagrams and traceability diverging from the implementation | Diagrams and traceability aligned ([diagram review record](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/diagrams/compliance.md)) |
| Export simplification, 11 Nov 2026 | Admin export took four interactions ([issue #15](https://github.com/Et1enneee/comp3500-logistics/issues/15)) | Selected-date CSV export in three in-app interface interactions; the 11 Nov regression exercised all four role workflows ([browser checks](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/test-logs/2026-11-11-browser/browser.log)) |
| CI health tests, 11–12 Nov 2026 | The record of CI-run outcomes ([observations](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/availability/integration-observations.json)) had no regression test | Two regression tests added; suite reached 38 ([unit.log](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/test-logs/2026-11-12-regression/unit.log)) |

<!-- pagebreak -->

## 3. Requirements

**Functional requirements**

| FR | The system shall | Verification |
|---|---|---|
| FR-01 | create orders with lines and totals | [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/foundation.integration.ts) |
| FR-02 | enforce lifecycle and stock reservation/release | [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/orders.integration.ts) ([cancel tests](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/cancel.integration.ts)) |
| FR-03 | number orders and shipments; show owner tracking | [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/logistics-chain.integration.ts) |
| FR-04 | show inventory, stock-movement ledger and low-stock alerts | [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/inventory.integration.ts) |
| FR-05 | record order-event notifications and allow reading | [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/notifications.integration.ts) |
| FR-06 | provide admin aggregates and CSV export | [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/reports.integration.ts) |
| FR-07 | authenticate and enforce role/object access | [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/auth.integration.ts) |
| FR-08 | assign shipped orders and record delivery | [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/driver.integration.ts) |

- NFR-01 performance — API p95 (95th percentile) ≤2 s, first contentful paint p95 ≤3 s ([measurement](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/performance.json), §6).
- NFR-02 CI health — every commit ends in a green build with unit, integration and browser runs recorded ([observations](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/availability/integration-observations.json)).
- NFR-03 least privilege — role gates; delivery address only to the assigned driver ([privacy tests](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/privacy.integration.ts)).
- NFR-04 interaction budget — every core operation (eleven, listed in §8) is reachable in at most three in-app interface interactions; one interaction is a fill, selection or click, and login and navigation are session setup ([walkthrough](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/walkthrough/automated-walkthrough.md)).
- NFR-05 process quality — green CI ([observations](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/availability/integration-observations.json)).

**Table B. Risk coverage** ([detailed mapping](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/requirements/risk-coverage.md))

| Risk | Addressed by | Evidence |
|---|---|---|
| RK-01 schedules | [scheduling plan](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/risks.md) | [register](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/increments.md) |
| RK-02 contract rework | Transition table locked as test constants | [transition tests](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/constants.test.ts) |
| RK-03 test week | [Traceability](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/traceability.md) | [scope priorities](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/risks.md) |
| RK-04 setup | NFR-05 | [CI workflow](https://github.com/Et1enneee/comp3500-logistics/blob/main/.github/workflows/ci.yml) |
| RK-05 demo data | Deterministic seed with regression test | [seed regression test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/seed.integration.ts) |
| RK-06 coursework squeeze | Weekly re-planning | [risk plan](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/risks.md) |
| RK-07 stack | Setup guide | [setup guide](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/README.md) |
| RK-08 video deadlines | Weekly re-planning | [risk plan](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/risks.md) |
| RK-09 multi-warehouse or hosted access beyond the course demo | Accepted: out of course scope (§1) | [risk plan](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/risks.md) |
| RK-10 personal data beyond demo seed | Accepted: seed data only, no real subjects (§1) | [risk plan](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/risks.md) |

<!-- pagebreak -->

## 4. System models

The four layers — pages, routes, handlers, Prisma/SQLite persistence (ORM over SQLite) — separate concerns. Figures 1–5 answer, in order: what each role can do; how orders transition and stock changes; how entities relate; how the confirmation transaction proceeds; how the layers connect. Each figure links its PlantUML source.

Each item references one product; each order has one or more items; each order has at most one shipment; products accumulate ledger entries; notifications relate to at most one order; each order belongs to one user; each shipment records zero or more tracking events.

![Use cases](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics/docs/closure/usecase.svg)

*Figure 1. Role functions: thirteen use cases grouped under four role actors.* [Source](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/closure/usecase.puml).

<!-- pagebreak -->

![Order lifecycle](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics/docs/diagrams/state-machine.svg)

*Figure 2. Order transitions and stock effects: each transition states its stock effect — reserve, release or none.* [Source](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/diagrams/state-machine.puml).

<!-- pagebreak -->

![Entity relationships](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics/docs/diagrams/er.svg)

*Figure 3. Data relationships: User, Order, OrderItem, Product, Shipment, TrackingEvent, InventoryLog and Notification with their multiplicities, drawn as an ER model.* [Source](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/diagrams/er.puml).

![Confirmation sequence](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics/docs/diagrams/sequence-diagram.svg)

*Figure 4. Confirmation transaction: session guard, conditional writes, rollback on failure or short stock.* [Source](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/diagrams/sequence-diagram.puml).

<!-- pagebreak -->

![Layered architecture](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics/docs/diagrams/architecture.svg)

*Figure 5. Four layers: role pages call HTTP routes, routes call handlers, handlers use Prisma/SQLite.* [Source](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/diagrams/architecture.puml).

## 5. Implementation

The confirmation transaction reserves stock. Lifecycle: CREATED → CONFIRMED → PICKING → SHIPPED → IN_TRANSIT → DELIVERED; CANCELLED from CREATED or CONFIRMED. Cancellations restock unless CREATED. Staff cancellation is restricted to CONFIRMED.

Cancellation permissions:

| Role | State | Effect |
|---|---|---|
| Customer | CREATED | cancel, no restock |
| Customer | CONFIRMED | cancel, restock |
| Staff | CREATED | rejected |
| Staff | CONFIRMED | cancel, restock |
| Customer, staff | PICKING onwards | rejected |

A CREATED order has not yet been accepted by staff, so staff cannot cancel it.

Key designs and their verification:

| Design | Implementation | Verification |
|---|---|---|
| Preconditions: order still CREATED, stock sufficient | [order-api.ts:250–253](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/order-api.ts#L250-L253), [276–280](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/order-api.ts#L276-L280) | [Orders](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/orders.integration.ts) |
| Confirmation: atomic; rollback on short stock; repeats rejected (HTTP 409) | [order-api.ts:245–293](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/order-api.ts#L245-L293) | [Orders](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/orders.integration.ts) |
| driverId: SHIPPED only, kept after delivery | [driver-api.ts:44–51](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/driver-api.ts#L44-L51); [transition](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/order-api.ts#L321-L330) | [Driver](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/driver.integration.ts) |
| FR-03 numbering and tracking | [create-order.ts:91](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/create-order.ts#L91), [shipment-api.ts:62](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/shipment-api.ts#L62) | [Logistics chain](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/logistics-chain.integration.ts) |
| FR-04 inventory, ledger, low-stock alerts; staff replenishment adds stock | [order-api.ts:281](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/order-api.ts#L281), [398](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/order-api.ts#L398), [inventory-api.ts:142](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/inventory-api.ts#L142) | [Inventory](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/inventory.integration.ts) |
| FR-05/06/07 handlers | [notify.ts:19](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/notify.ts#L19), [reports-api.ts:105](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/reports-api.ts#L105), [http.ts:58](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/http.ts#L58)  | [Notifications](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/notifications.integration.ts), [Reports](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/reports.integration.ts), [Auth](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/auth.integration.ts) |


<!-- pagebreak -->

## 6. Verification

[CI](https://github.com/Et1enneee/comp3500-logistics/actions/runs/43175733067) records 38 unit and 140 integration checks across the suites linked in §3; 2 integrity checks guard the evidence chain rather than product behaviour ([integrity checks](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/integrity.check.mjs)): the demo-data reset step (which wipes and reseeds the SQLite database) is refused unless RESET_DEMO_DATA=YES, and the packaged bundle's SHA-256 manifest (SHA256SUMS.txt) must match the repository source — verified by the recorded CI run at packaging. The [integration log](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/test-logs/2026-11-12-regression/integration.log) records the 12 Nov integration run, the [unit.log](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/test-logs/2026-11-12-regression/unit.log) "Tests 38 passed (38)" and the [walkthrough record](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/test-logs/2026-11-11-browser/browser.log) "Browser acceptance passed: 26 checks".

Loopback [measurement](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/performance.json) (11 Nov) gave API p95 3.2–13.6 ms and FCP p95 64–96 ms against 2 s and 3 s targets — loopback only, not representative of public networks or high concurrency.

The reviews (Table A rows 2 and 6) served as static verification of requirements, models and code; row 7's export fix was validated through the interface (§8).

## 7. Evolution

Three reviews drove the changes: the 17 Oct review found the confirmation defect, fixed by §5; the 10–11 Nov review aligned diagrams and traceability and replaced the NFR-02 availability window with CI-run checks and scoped NFR-01 measurement to the local loopback; the export review of 11 Nov (Table A row 7) added the direct export path ([issue #15](https://github.com/Et1enneee/comp3500-logistics/issues/15)); the two CI-health regression tests followed as their own increment (Table A row 8; suite 36 → 38).

## 8. Validation

The [automated walkthrough](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/walkthrough/automated-walkthrough.md) (executed by Oscar and Li; recorded as the browser.log quoted below) exercises eleven core operations — Create an order; Open order details; Confirm order; Start picking; Ship order; Assign driver; Simulate pickup; Simulate delivery; Apply report date filter; Export current report; Export selected dates without applying filter — at most three in-app interface interactions each; pickup and delivery are simulated in-app, real courier integration being out of scope (RK-09). "Browser acceptance passed: 26 checks" — 20 operation checks (5 once, 3 twice, 3 thrice), plus 6 cross-cutting checks (two each for input validation, session handling and interface). No application code changed after the walkthrough; the 12 Nov additions were the Table A row-8 regression tests, so the 11 Nov browser record stands.

## 9. Feedback and reconciliation

**Sources:** reviews were held by the whole team; test runs and the walkthrough were executed by Oscar and Li.

**Table C. Feedback to evidence**

| Feedback | Disposition | Source | Evidence |
|---|---|---|---|
| Diagrams diverged | Models corrected | 10–11 Nov | [Corrections](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/diagrams/compliance.md) |
| Stock effects were recorded under FR-04 | Moved stock effects to FR-02; replenishment recording stayed in FR-04 | 17 Oct | [Traceability](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/traceability.md) |
| Register rows had thin triggers and outcomes | Register rewritten 10–11 Nov; history in git | 10–11 Nov | [Register](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/increments.md) · [history](https://github.com/Et1enneee/comp3500-logistics/commits/main/logistics/docs/process/increments.md) |
| The filter-then-export path took four interactions | Combined path not adopted: its filter and export steps already total four interactions, so only a direct date-selector path meets the budget adopted in the same review; issue closed | 11 Nov review | [Issue #15](https://github.com/Et1enneee/comp3500-logistics/issues/15) |
| No CI-health regression test | Reached 38 tests | 11 Nov | [Log](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/test-logs/2026-11-12-regression/unit.log) |
| NFR-02 originally set daily availability 08:00–24:00 local time | Replaced by CI-run checks (§3); each green run runs the unit, integration and browser suites (§6) on the current commit | 10–11 Nov | [Requirements revision log](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/requirements/srs.md#7-document-control) |
| NFR-01 assumed a hosted measurement model | Scoped to loopback measurement; budgets unchanged (§6) | 10–11 Nov review | [measurement](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/performance.json) |

## 10. Evidence

The baseline record snapshots suite counts at packaging: 38 unit, 140 integration, 2 integrity from the 12 Nov run; 26 browser checks from 11 Nov ([baseline](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/BASELINE-final-report.json)).

[Traceability](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/traceability.md).
