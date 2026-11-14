# COMP 3500SEF · Final Report

**Warehouse Logistics Management System**  
**Group 42:** Tang Yi Jie, Yin Pei Xu, Tang Chao, Yang Ting Zhang, Wu Peng Bo, Chung Ngon Man, Li Mu Qiu.

## 1. Scope

The goals are traceable order decisions — each order's history is auditable through ledger entries and notifications — and a role-separated workflow. Customers order; staff fulfil; drivers deliver; administrators report. Deployment is local-only: one host, one app (§4); demo seed data only, no real personal data (RK-10).

## 2. Development process

An increment is a unit of work closed by a review or recorded test run.

**Table A. Increments**

| Increment and date | Trigger | Outcome |
|---|---|---|
| Planning, 9–11 Oct 2026 | Coursework kickoff | Scope, responsibilities, contracts recorded ([register](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/increments.md)) |
| 17 Oct review | Order and stock functions reviewed | Two defects; fixed as row 3 |
| Confirmation, 26–28 Oct 2026 | Row-2 defects: repeat submits, no ledger | Transaction verified ([orders tests](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/orders.integration.ts)) |
| Integrated application, 1 Nov 2026 | Role functions integrated | Four workflows runnable end to end |
| Driver and privacy, 2 Nov 2026 | Driver tests outstanding | Both pass — data-minimisation, NFR-03 ([privacy tests](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/privacy.integration.ts)) |
| Diagram review, 10–11 Nov 2026 | Diagrams diverged | Aligned ([review record](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/diagrams/compliance.md)) |
| Export simplification, 11 Nov 2026 | Admin export took four interactions ([issue #15](https://github.com/Et1enneee/comp3500-logistics/issues/15)) | Selected-date export in three in-app interface interactions ([browser checks](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/test-logs/2026-11-11-browser/browser.log)) |
| CI health tests, 11–12 Nov 2026 | CI-run record untested | Two regression tests added; suite reached 38 ([unit.log](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/test-logs/2026-11-12-regression/unit.log)) |

<!-- pagebreak -->

## 3. Requirements

| FR | Requirement and verification |
|---|---|
| FR-01 | create orders with lines and totals [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/foundation.integration.ts) |
| FR-02 | enforce lifecycle and stock reservation/release [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/orders.integration.ts) ([cancel](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/cancel.integration.ts)) |
| FR-03 | number orders and shipments; track owners [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/logistics-chain.integration.ts) |
| FR-04 | show inventory, stock-movement ledger and low-stock alerts [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/inventory.integration.ts) |
| FR-05 | record and read order notifications [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/notifications.integration.ts) |
| FR-06 | provide admin aggregates and CSV export [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/reports.integration.ts) |
| FR-07 | authenticate and enforce role/object access [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/auth.integration.ts) |
| FR-08 | assign shipped orders and record delivery [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/driver.integration.ts) |

- NFR-01 performance — API p95 (95th percentile) ≤2 s, first contentful paint p95 ≤3 s ([measurement](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/performance.json)).
- NFR-02 CI health — every commit ends in green unit, integration and browser runs on every machine ([observations](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/availability/integration-observations.json)).
- NFR-03 least privilege — role gates; delivery address only to the assigned driver ([privacy tests](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/privacy.integration.ts)).
- NFR-04 interaction budget — every core operation (§8) takes at most three in-app interface interactions; one interaction is a fill, selection or click ([walkthrough](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/walkthrough/automated-walkthrough.md)).
- NFR-05 process quality — every increment closes on a recorded review or test run (§2).

**Table B. Risk coverage**

RK-01–10, with mitigations, are in [risk coverage](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/requirements/risk-coverage.md) and [risk plan](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/risks.md); RK-09–10 are out of scope (§1).

<!-- pagebreak -->

## 4. System models

Each **order item** references one product; orders hold one or more items and belong to one user; an order has at most one shipment, which records tracking events; products accumulate ledger entries; notifications relate to at most one order.

![Use cases](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics/docs/closure/usecase.svg)

*Figure 1. Role functions: four actors, thirteen use cases — what each can do.*

<!-- pagebreak -->

![Order lifecycle](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics/docs/diagrams/state-machine.svg)

*Figure 2. Order transitions and stock effects: each transition reserves, releases or neither.*

<!-- pagebreak -->

![Entity relationships](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics/docs/diagrams/er.svg)

*Figure 3. Data relationships: User, Order, OrderItem, Product, Shipment, TrackingEvent, InventoryLog, Notification with multiplicities — the ER model.*

![Confirmation sequence](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics/docs/diagrams/sequence-diagram.svg)

*Figure 4. Confirmation transaction: session guard, conditional writes, rollback on failure or short stock.*

<!-- pagebreak -->

![Layered architecture](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics/docs/diagrams/architecture.svg)

*Figure 5. Four layers: pages call routes, routes call handlers, handlers use Prisma/SQLite persistence.*

## 5. Implementation

Confirmation reserves stock. Lifecycle: CREATED → CONFIRMED → PICKING → SHIPPED → IN_TRANSIT → DELIVERED; CANCELLED from CREATED or CONFIRMED.

Cancellation:

| Role | State | Effect |
|---|---|---|
| Customer | CREATED | cancel, no restock |
| Customer | CONFIRMED | cancel, restock |
| Staff | CREATED | rejected |
| Staff | CONFIRMED | cancel, restock |
| Customer, staff | PICKING onwards | rejected |

A CREATED order stays with the customer; staff have no refuse action in scope (§1); the lifecycle is locked as test constants ([tests](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/constants.test.ts)).

Designs:

| Design | Implementation and verification |
|---|---|
| Preconditions: CREATED, stock sufficient | [order-api.ts:250](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/order-api.ts#L250); [Orders](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/orders.integration.ts) |
| Confirmation: atomic; rollback on short stock; repeats rejected (HTTP 409) | [order-api.ts:245](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/order-api.ts#L245); [Orders](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/orders.integration.ts) |
| FR-03 numbering and tracking; FR-04 ledger, alerts, staff replenishment | [create-order.ts:91](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/create-order.ts#L91), [inventory-api.ts:142](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/inventory-api.ts#L142); [Inventory](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/inventory.integration.ts) |

FR-05/06/07 use the same handler pattern ([notify.ts](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/notify.ts), [reports-api.ts](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/reports-api.ts), [http.ts](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/http.ts)).

<!-- pagebreak -->

## 6. Verification

[CI](https://github.com/Et1enneee/comp3500-logistics/actions/runs/43175733067) records 38 unit, 140 integration checks; 2 integrity checks pin the evidence chain — the demo-data reset is refused unless RESET_DEMO_DATA=YES, and the packaged bundle's SHA-256 manifest must match the pinned source ([integrity checks](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/integrity.check.mjs)). Logs: [integration](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/test-logs/2026-11-12-regression/integration.log) "tests 140", "pass 140"; [unit](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/test-logs/2026-11-12-regression/unit.log) "Tests 38 passed (38)"; [browser](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/test-logs/2026-11-11-browser/browser.log) "Browser acceptance passed: 26 checks".

Loopback [measurement](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/performance.json) (11 Nov): API p95 3.2–13.6 ms, first contentful paint p95 64–96 ms, against 2 s and 3 s targets; not representative of public networks.

Reviews (Table A rows 2 and 6; checklist inspections) verified requirements and models; row 7's fix was validated through the interface (§8).

## 7. Evolution

Three reviews drove changes: 17 Oct found the confirmation defect (§5); 10–11 Nov aligned diagrams and traceability and rewrote NFR-01/02 — the daily window (08:00–24:00) became CI-run checks; 11 Nov added the direct export path ([issue #15](https://github.com/Et1enneee/comp3500-logistics/issues/15)); two regression tests followed as row 8 (36 → 38).

## 8. Validation

The [automated walkthrough](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/walkthrough/automated-walkthrough.md) exercises eleven core operations — create order; open details; confirm; start picking; ship; assign driver; record pickup; record delivery; filter report; export current; export selected dates — at most three in-app interface interactions each; pickup and delivery are recorded in-app (RK-09). "Browser acceptance passed: 26 checks" — 20 operation checks, 6 cross-cutting (input validation, session handling, interface). No application code changed after this run; row 8 added tests.

## 9. Feedback and reconciliation

**Sources:** whole-team reviews; test runs and walkthrough by Oscar and Li.

**Table C. Feedback to evidence**

| Feedback (source, date) | Disposition and evidence |
|---|---|
| Diagrams diverged (10–11 Nov, [corrections](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/diagrams/compliance.md)) | Corrected |
| Stock effects under FR-04 (17 Oct, [traceability](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/traceability.md)) | Renumbered FR-02 |
| Thin register triggers (10–11 Nov, [register](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/increments.md), [history](https://github.com/Et1enneee/comp3500-logistics/commits/main/logistics/docs/process/increments.md)) | Rewritten |
| Filter-then-export took four interactions (11 Nov, [issue #15](https://github.com/Et1enneee/comp3500-logistics/issues/15)) | Combined path not adopted; date selection meets the budget; issue closed |
| No CI-health test (11 Nov, [log](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/test-logs/2026-11-12-regression/unit.log)) | Suite reached 38 |
| NFR-02 daily availability window (10–11 Nov, [revision log](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/requirements/srs.md#7-document-control)) | Replaced by CI-run checks (§3) |
| NFR-01 hosted measurement (10–11 Nov, [measurement](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/performance.json)) | Scoped to loopback (§6) |

## 10. Evidence

38 unit, 140 integration, 2 integrity (12 Nov), 26 browser checks (11 Nov) — [BASELINE](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/BASELINE-final-report.json). [Traceability](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/traceability.md).
