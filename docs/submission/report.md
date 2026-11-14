# COMP 3500SEF · Final Report

**Warehouse Logistics Management System**  
**Group 42:** Tang Yi Jie, Yin Pei Xu, Tang Chao, Yang Ting Zhang, Wu Peng Bo, Chung Ngon Man, Li Mu Qiu.

## 1. Scope

The goals are traceable order decisions — each order's history is auditable through ledger entries and notifications — and a role-separated workflow. Customers order; staff fulfil; drivers deliver; administrators report. Deployment is local-only: one app (§4); seed data only (RK-10).

## 2. Development process

An increment is work closed by a review or test run.

**Table A. Increments**

| Increment and date | Trigger | Outcome |
|---|---|---|
| Planning, 9–11 Oct 2026 | Coursework kickoff | Scope, responsibilities, contracts recorded ([register](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/increments.md)) |
| 17 Oct review | Stock and order review | Two defects; fixed as row 3 |
| Confirmation, 26–28 Oct 2026 | Row-2 defects: repeat submits, no ledger | Transaction verified ([orders tests](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/orders.integration.ts)) |
| Integrated application, 1 Nov 2026 | Role functions integrated | All four workflows integrated |
| Driver and privacy, 2 Nov 2026 | Driver tests outstanding | Both pass ([privacy tests](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/privacy.integration.ts)) |
| Diagram review, 10–11 Nov 2026 | Diagrams diverged | Aligned ([review record](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/diagrams/compliance.md)) |
| Export simplification, 11 Nov 2026 | Admin export took four interactions ([issue #15](https://github.com/Et1enneee/comp3500-logistics/issues/15)) | Selected-date export in three in-app interactions |
| CI health tests, 11–12 Nov 2026 | CI-run outcomes untested | Two regression tests; suite reached 38 ([unit.log](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/test-logs/2026-11-12-regression/unit.log)) |

## 3. Requirements

- FR-01 create orders with lines and totals [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/foundation.integration.ts).
- FR-02 enforce lifecycle and stock release [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/orders.integration.ts) ([cancel](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/cancel.integration.ts)).
- FR-03 number orders and shipments, track owners [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/logistics-chain.integration.ts).
- FR-04 show inventory, ledger, low-stock alerts [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/inventory.integration.ts).
- FR-05 record and read order notifications [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/notifications.integration.ts).
- FR-06 provide admin aggregates and CSV [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/reports.integration.ts).
- FR-07 authenticate and enforce access [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/auth.integration.ts).
- FR-08 assign orders and record delivery [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/driver.integration.ts).


- NFR-01 performance — API p95 (95th percentile) ≤2 s, first contentful paint ≤3 s ([measurement](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/performance.json)).
- NFR-02 CI health — every commit ends in green unit, integration and browser runs ([observations](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/availability/integration-observations.json)).
- NFR-03 least privilege — role gates; address only to the driver ([privacy tests](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/privacy.integration.ts)).
- NFR-04 interaction budget — every core operation (§8) takes at most three in-app interactions; one interaction is a fill, selection or click ([walkthrough](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/walkthrough/automated-walkthrough.md)).
- NFR-05 process quality — every increment closes on a recorded review or test run.

**Table B. Risk coverage:** RK-01–10 ([coverage](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/requirements/risk-coverage.md)).

## 4. System models

Four layers separate concerns: pages, routes, handlers, Prisma/SQLite persistence.

Each **order item** references one product; orders hold one or more items and one user; an order has at most one shipment recording events; products accumulate movements (InventoryLog); notifications relate to at most one order.

![Use cases](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics/docs/closure/usecase.svg)

*Figure 1. Role functions: four actors, thirteen use cases.*

![Order lifecycle](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics/docs/diagrams/state-machine.svg)

*Figure 2. Order transitions: reserve, release or neither.*

![Entity relationships](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics/docs/diagrams/er.svg)

*Figure 3. Data relationships: entities and multiplicities as an ER model.*

![Confirmation sequence](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics/docs/diagrams/sequence-diagram.svg)

*Figure 4. Confirmation transaction: guard, conditional writes, rollback on failure or short stock.*

![Layered architecture](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics/docs/diagrams/architecture.svg)

*Figure 5. Four layers: pages, routes, handlers, Prisma/SQLite.*

## 5. Implementation

Confirmation reserves stock. Lifecycle: CREATED → CONFIRMED → PICKING → SHIPPED → IN_TRANSIT → DELIVERED; CANCELLED from CREATED or CONFIRMED.

| Role | Transition and effect |
|---|---|
| Customer | CREATED — cancel, no restock |
| Customer | CONFIRMED — cancel, restock |
| Staff | CREATED — rejected |
| Staff | CONFIRMED — cancel, restock |
| Customer, staff | PICKING+ — rejected |

A CREATED order stays with the customer; staff have no refuse action (§1); the lifecycle is locked as test constants ([tests](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/constants.test.ts)).

| Design | Implementation and verification |
|---|---|
| Confirmation: atomic; rollback on short stock; repeats rejected (HTTP 409) | [order-api.ts:245](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/order-api.ts#L245); [Orders](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/orders.integration.ts) |
| driverId: SHIPPED only, kept after delivery | [driver-api.ts:44](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/driver-api.ts#L44); [Driver](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/driver.integration.ts) |
| FR-03 numbering and tracking; FR-04 ledger, alerts, replenishment | [create-order.ts:91](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/create-order.ts#L91), [inventory-api.ts:142](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/inventory-api.ts#L142); [Inventory](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/inventory.integration.ts) |

## 6. Verification

[CI](https://github.com/Et1enneee/comp3500-logistics/actions/runs/43175733067) records 38 unit, 140 integration checks; 2 integrity checks guard the evidence chain: the demo-data reset needs RESET_DEMO_DATA=YES and the bundle's SHA-256 manifest must match the source ([integrity checks](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/integrity.check.mjs)). Logs: [integration](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/test-logs/2026-11-12-regression/integration.log) "tests 140", "pass 140"; [unit](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/test-logs/2026-11-12-regression/unit.log) "Tests 38 passed (38)"; [browser](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/test-logs/2026-11-11-browser/browser.log) "Browser acceptance passed: 26 checks".

Loopback [measurement](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/performance.json) (11 Nov): API p95 3.2–13.6 ms, first contentful paint 64–96 ms against 2 s/3 s; not representative of public networks.

Reviews (Table A rows 2 and 6) verified requirements and models; row 7's fix checked via the interface (§8).

## 7. Evolution

Three reviews drove changes: 17 Oct found two defects — repeat submits and a missing ledger — fixed by §5; 10–11 Nov aligned diagrams, traceability and rewrote NFR-01/02, the window (08:00–24:00) becoming CI-run checks; 11 Nov added the direct export path ([issue #15](https://github.com/Et1enneee/comp3500-logistics/issues/15)); two tests followed as row 8 (36→38).

## 8. Validation

The [automated walkthrough](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/walkthrough/automated-walkthrough.md) covers eleven core operations (of the thirteen use cases in Figure 1) — create order; open details; confirm; start picking; ship; assign driver; record pickup; record delivery; filter report; export current; export selected dates — at most three in-app interactions each; pickup and delivery are recorded in-app. "Browser acceptance passed: 26 checks" — 20 operation checks (5 once, 3 twice, 3 thrice) plus 6 cross-cutting (two each: input validation, session handling, interface). No application code changed after this run; row 8 added tests.

## 9. Feedback and reconciliation

**Table C. Feedback to evidence**

| Feedback (source, date) | Disposition and evidence |
|---|---|
| Diagrams diverged (10–11 Nov, [corrections](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/diagrams/compliance.md)) | Corrected |
| Stock effects under FR-04 (17 Oct, [traceability](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/traceability.md)) | Moved to FR-02 |
| Thin register triggers (10–11 Nov, [register](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/increments.md)) | Rewritten |
| Filter-then-export took four interactions (11 Nov, [issue #15](https://github.com/Et1enneee/comp3500-logistics/issues/15)) | Combined path rejected; date selection meets budget; issue closed |
| No CI-health test (11 Nov, [log](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/test-logs/2026-11-12-regression/unit.log)) | Suite reached 38 |
| NFR-02 daily availability window (10–11 Nov, [revision log](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/requirements/srs.md#7-document-control)) | CI-run checks (§3) |

## 10. Evidence

38 unit / 140 integration / 2 integrity / 26 browser checks (11 Nov) ([BASELINE](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/BASELINE-final-report.json), [traceability](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/traceability.md)).
