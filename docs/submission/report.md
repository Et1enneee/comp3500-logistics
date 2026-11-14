# COMP 3500SEF · Final Report

**Warehouse Logistics Management System**  
**Group 42:** Tang Yi Jie, Yin Pei Xu, Tang Chao, Yang Ting Zhang, Wu Peng Bo, Chung Ngon Man, Li Mu Qiu.  
**Testing:** Chung Ngon Man, Li Mu Qiu.

## 1. Scope

Goals: traceable decisions and role-separated workflows. Roles: customer, staff, driver, administrator. Local-only: one app; seed data only (RK-05/10, Table B).

## 2. Development process

**Table A. Increments**

| Increment and date | Trigger / activity | Outcome |
|---|---|---|
| Planning, 9–11 Oct 2026 | Coursework kickoff | Scope, roles, API contracts ([register](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/increments.md)) |
| 17 Oct review | Stock and order review | Two defects found; fixed in row 3 |
| Confirmation, 26–28 Oct 2026 | Row-2 defects: repeat submits accepted, no stock ledger | Transaction verified ([orders tests](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/orders.integration.ts)) |
| Integrated application, 1 Nov 2026 | Role functions integrated | Customer, staff, admin workflows end-to-end |
| Driver and privacy, 2 Nov 2026 | Driver tests outstanding | Both pass ([driver](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/driver.integration.ts), [privacy](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/privacy.integration.ts)) |
| Diagram review, 10–11 Nov 2026 | Diagrams diverged from the code | Aligned ([review record](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/diagrams/compliance.md)) |
| Export simplification, 11 Nov 2026 | Admin export took four interactions ([issue #15](https://github.com/Et1enneee/comp3500-logistics/issues/15)) | Selected-date export in three interactions — two fills, one click |
| CI health tests, 11–12 Nov 2026 | No test covered CI-run outcomes | Two regression tests; unit suite reached 38 ([unit.log](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/test-logs/2026-11-12-regression/unit.log)) |

## 3. Requirements

- FR-01 create orders with line items [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/foundation.integration.ts).
- FR-02 enforce lifecycle, stock release [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/orders.integration.ts) ([cancel](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/cancel.integration.ts)).
- FR-03 number orders and shipments; track the order's user [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/logistics-chain.integration.ts).
- FR-04 inventory, ledger, low-stock alerts [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/inventory.integration.ts).
- FR-05 record, read notifications [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/notifications.integration.ts).
- FR-06 admin aggregates, CSV [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/reports.integration.ts).
- FR-07 authenticate, access [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/auth.integration.ts).
- FR-08 assign, deliver [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/driver.integration.ts).

- NFR-01 performance: API p95 ≤2 s, first contentful paint p95 ≤3 s on the local host ([measurement](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/performance.json)).
- NFR-02 CI health — every commit ends in green unit, integration, browser runs ([runs](https://github.com/Et1enneee/comp3500-logistics/actions), [ci.yml](https://github.com/Et1enneee/comp3500-logistics/blob/main/.github/workflows/ci.yml), [observations](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/availability/integration-observations.json)).
- NFR-03 least privilege: role gates; delivery address only to the assigned driver ([privacy tests](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/privacy.integration.ts)).
- NFR-04 interaction budget: every core operation (the eleven in §8) takes at most three in-app interactions (one interaction = one fill, selection or click; navigation excluded) ([walkthrough](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/walkthrough/automated-walkthrough.md)).
- NFR-05 process quality — every increment closes on a recorded review or test run.

**Table B. Risk coverage** (RK = risk IDs, [risks.md](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/risks.md))

| Risk | Addressed by | Evidence |
|---|---|---|
| ①RK-01/03/06/08 schedule, test week, coursework | weekly re-planning, scope priorities | [risk plan](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/risks.md) |
| ②RK-02 contract rework | lifecycle locked as test constants | [constants tests](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/constants.test.ts) |
| ③RK-04/07 setup, stack | setup guide; CI per commit | [README](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/README.md) [ci.yml](https://github.com/Et1enneee/comp3500-logistics/blob/main/.github/workflows/ci.yml) |
| ④RK-05 demo data | deterministic seed, regression-tested | [seed test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/seed.integration.ts) |
| ⑤RK-09/10 hosting; personal data | team decision, 9 Oct — seed data only, no real personal data; NFR-03 governs in-app access | §1; [risk plan](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/risks.md) |

## 4. System models

Layers: pages, routes, handlers, Prisma/SQLite. **Order items** reference one product; orders belong to one user; an order has at most one shipment; products accumulate movements (InventoryLog).

![Use cases](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics/docs/closure/usecase.svg)

*Figure 1. Thirteen use cases: Sign in; Create order; Track order; Read notifications; Cancel order; Confirm order; Pick order; Ship order; Assign driver; Manage inventory; View assigned deliveries; Update delivery; View reports.*

![Order lifecycle](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics/docs/diagrams/state-machine.svg)

*Figure 2. Order transitions: which reserve stock, which release it, which leave it unchanged.*

![Entity relationships](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics/docs/diagrams/er.svg)

*Figure 3. Entities and multiplicities.*

![Confirmation sequence](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics/docs/diagrams/sequence-diagram.svg)

*Figure 4. Confirmation: authenticated session, stock-checked writes, rollback.*

![Layered architecture](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics/docs/diagrams/architecture.svg)

*Figure 5. The four layers.*

## 5. Implementation

Confirmation reserves stock; lifecycle CREATED→CONFIRMED→PICKING→SHIPPED→IN_TRANSIT→DELIVERED; cancel from CREATED/CONFIRMED.

Cancellation permissions:

| Role | Transition and effect |
|---|---|
| Customer | CREATED: cancel, no restock |
| Customer | CONFIRMED: cancel, restock |
| Staff | CREATED: rejected |
| Staff | CONFIRMED: cancel, restock |
| Customer, staff | PICKING onwards: rejected |

A CREATED order leaves CREATED only by the customer's cancel or the staff confirmation.

Atomic confirmation (HTTP 409 on repeats; rollback on short stock); driverId set at SHIPPED, immutable after; FR-03/04 verified ([order-api](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/order-api.ts#L245), [driver-api](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/driver-api.ts#L44), [inventory-api](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/lib/inventory-api.ts#L142)).

## 6. Verification

Verification checks the implementation against §3; validation exercises the delivered workflows (§8). [CI](https://github.com/Et1enneee/comp3500-logistics/actions/runs/43175733067) records 38 unit, 140 integration, 2 integrity checks: the demo-data reset requires RESET_DEMO_DATA=YES (evidence protection), and the packaged submission's SHA-256 manifest must match the source ([integrity checks](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/tests/integrity.check.mjs)). Logs: [integration](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/test-logs/2026-11-12-regression/integration.log) "tests 140", "pass 140"; [unit](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/test-logs/2026-11-12-regression/unit.log) "Tests 38 passed (38)".

Loopback [measurement](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/performance.json): p95 3.2–13.6 ms, first contentful paint p95 64–96 ms (30 samples per endpoint) vs 2/3 s — loopback, not representative of public networks.

Reviews (17 Oct, 10–11 Nov, 11 Nov) statically verified requirements and models; the export fix was then validated through the interface (§8).

## 7. Evolution

Reviews: 17 Oct found two defects (repeat submits, missing ledger) fixed by the confirmation transaction (§5); 10–11 Nov aligned diagrams; NFR-01 → loopback, NFR-02 → CI-run checks. Feedback that the CI record was untested added two regression tests (row 8; unit suite: 36→38).

## 8. Validation

[Walkthrough](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/walkthrough/automated-walkthrough.md) covers eleven core operations: create order; open details; confirm; start picking; ship; assign driver; record pickup; record delivery; filter report; export current; export selected dates — at most three interactions each; the 26 checks reach all thirteen of Figure 1's use cases ([coverage map](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/walkthrough/coverage-map.md)). "Browser acceptance passed: 26 checks" ([browser log](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/test-logs/2026-11-11-browser/browser.log), the walkthrough run): 20 checks (five operations once, three twice, three thrice) plus 6 cross-cutting checks — validation, session, interface: two each. During report preparation, the two testers (Chung Ngon Man, Li Mu Qiu) logged 64 attempts (32 each) for six core tasks — all unaided; median 2.1 min per session ([user-validation](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/user-validation.md)).

## 9. Feedback and reconciliation

**Sources:** whole-team reviews (all seven members); test runs and the scripted walkthrough executed by Chung Ngon Man and Li Mu Qiu (Testing).

**Table C. Feedback**

| Feedback (source, date) | Disposition and evidence |
|---|---|
| Stock effects under FR-04 (17 Oct, [traceability](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/traceability.md)) | Moved to FR-02 |
| Thin trigger descriptions (10–11 Nov, [register](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/process/increments.md)) | Rewritten (Table A) |
| Filter-then-export took four interactions (11 Nov, [issue #15](https://github.com/Et1enneee/comp3500-logistics/issues/15)) | Combined path proposed and rejected (its steps already totalled four); adopted the direct path — meets NFR-04 (row 7); tracked in issue #15 |
| No CI-health test (11 Nov, [unit.log](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/evidence/test-logs/2026-11-12-regression/unit.log)) | Two regression tests (row 8); suite 38 |
| NFR-01/02 assumed hosted measurement, daily window (10–11 Nov, [revision log](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/requirements/srs.md#7-document-control)) | NFR-01 → loopback; NFR-02 → CI-run checks (§6) |

## 10. Evidence

38 unit (row 8's two included), 140 integration, 2 integrity (12 Nov); 26 browser checks (11 Nov) ([history](https://github.com/Et1enneee/comp3500-logistics/commits/main)) — [BASELINE](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/BASELINE-final-report.json). [Traceability](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics/docs/traceability.md). Limits: local-only, seed data, in-team validation (§1, §8).
