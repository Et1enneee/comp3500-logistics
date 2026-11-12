https://github.com/Et1enneee/comp3500-logistics

# COMP 3500SEF · Final Report

**Warehouse Logistics Management System**  
**Group 42:** Tang Yi Jie, Yin Pei Xu, Tang Chao, Yang Ting Zhang, Wu Peng Bo, Chung Ngon Man, Li Mu Qiu.

## 1. Scope

The goals are traceable order decisions and a role-separated workflow. Customers order and track; staff confirm, pick, ship and assign; drivers simulate assigned deliveries; administrators report. The local application serves one warehouse using Next.js, TypeScript, Prisma and SQLite. Real GPS, barcode scanning, recipient telephone collection, payment and carrier integration are outside scope. Deployment is local-only; data integrity is enforced by transactional guards (§5). Requirements and models link to evidence; §10 collects the trail.

## 2. Development process

Plan-driven increments have triggers and verified outcomes; integration and continuous integration provide feedback. Increments cover product and specification changes and recorded process milestones.

**Table A. Increment, trigger and outcome**

| Increment and date | Trigger | Outcome |
|---|---|---|
| Planning, 9 and 11 Oct 2026 | Project selection | Responsibilities and contracts recorded |
| Test-led review, 17 Oct 2026 | Assess order and stock functions | Defects recorded; led to the confirmation transaction (§5) |
| Confirmation, 26–28 Oct 2026 | Failed endpoint and missing ledger | Transaction verified |
| Integrated application, 1 Nov 2026 | Integrate foundation | Customer, staff and admin workflows |
| Driver and privacy, 2 Nov 2026 | Delivery and data minimisation | Assigned tasks and data-minimisation checks |
| Documentation hardening, 10–11 Nov 2026 | Model and evidence review | Diagrams and traceability aligned |
| Export simplification, 11 Nov 2026 | Scripted walkthrough finding ([issue #15](https://github.com/Et1enneee/comp3500-logistics/issues/15)) | Selected-date export in three actions; regression passed |

The [workflow](https://github.com/Et1enneee/comp3500-logistics/blob/main/.github/workflows/ci.yml), [issue tracker](https://github.com/Et1enneee/comp3500-logistics/issues) and [increment register](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/process/increments.md) record integration.

<!-- pagebreak -->

## 3. Requirements

The [specification](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/requirements/srs.md) defines obligations and rationale.

**Functional requirements and verification**

| FR | The system shall | Rationale | Verification |
|---|---|---|---|
| FR-01 | create orders with product lines and totals | start fulfilment | [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/tests/foundation.integration.ts) — creation and stock |
| FR-02 | enforce lifecycle and stock reservation or release | protect invariants | [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/tests/orders.integration.ts) — lifecycle and stock |
| FR-03 | number orders and shipments and show owner tracking | retrieve progress | [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/tests/logistics-chain.integration.ts) — identifiers and tracking |
| FR-04 | show inventory, replenishment, ledger (inventory movement log) and low-stock alerts | support replenishment | [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/tests/inventory.integration.ts) — inventory and alerts |
| FR-05 | record event notifications and allow reading | communicate progress | [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/tests/notifications.integration.ts) — notifications and reads |
| FR-06 | provide admin aggregates and CSV export | support review | [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/tests/reports.integration.ts) — aggregates and export |
| FR-07 | authenticate and enforce role and object access | protect data | [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/tests/auth.integration.ts) — authentication and boundaries |
| FR-08 | assign shipped orders and simulate delivery | complete handoff | [Test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/tests/driver.integration.ts) — assignment and delivery |

NFR-01 performance (API p95 ≤2 s, first contentful paint ≤3 s); NFR-02 integration availability (green build–test–browser runs recorded per increment); NFR-03 least privilege (role gates on every mutating endpoint); NFR-04 ≤3 actions per scripted operation; NFR-05 process quality (CI-verified increments).

**Table B. Risk coverage** ([detailed mapping](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/requirements/risk-coverage.md))

| Risk | Addressed by | Evidence |
|---|---|---|
| RK-01 scheduling slip | [Increment register](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/process/increments.md) | [scheduling plan](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/reference/legacy/risks.md) |
| RK-02 contract rework | FR-02, NFR-05 | [transition tests](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/lib/constants.test.ts) |
| RK-03 test-week capacity | [Priority register](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/reference/legacy/traceability-v0.md) | [scope priorities](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/reference/legacy/risks.md) |
| RK-04 setup delay | NFR-05 | [CI workflow](https://github.com/Et1enneee/comp3500-logistics/blob/main/.github/workflows/ci.yml) |
| RK-05 demo data | FR-01/04/06, NFR-05 | [seed regression test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/tests/seed.integration.ts) |
| RK-06 assignments and test squeeze | [Risk plan](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/reference/legacy/risks.md) | [assessment schedule](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/reference/legacy/risks.md) |
| RK-07 stack unfamiliarity | NFR-05 support | [setup guide](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/README.md) |
| RK-08 report and video compete for time | [Risk plan](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/reference/legacy/risks.md) | [report and video plan](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/reference/legacy/risks.md) |

<!-- pagebreak -->

## 4. System models

Five views link roles, lifecycle, data, transaction, layers. Local transactions preserve consistency without splitting services; state and stock guards enforce rules. The four layers — Role-specific pages, HTTP routes and authentication, Order/inventory/driver business handlers, Prisma/SQLite persistence — each isolate one concern.

![Use cases](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics-foundation/docs/closure/usecase.svg)

*Figure 1. Which roles perform each function?* [Source](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/closure/usecase.puml).

<!-- pagebreak -->

![Order lifecycle](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics-foundation/docs/diagrams/state-machine.svg)

*Figure 2. Which order transitions and stock effects are valid?* [Source](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/diagrams/state-machine.puml).

<!-- pagebreak -->

Each item references one product; each order has 0..1 shipment; each product has 0..* inventory logs.

![Entity relationships](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics-foundation/docs/er.svg)

*Figure 3. Data relationships: each order requires at least one item, enforced at the creation API.* [Source](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/er.puml).

![Confirmation sequence](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics-foundation/docs/diagrams/sequence-diagram.svg)

*Figure 4. How does confirmation commit or roll back?* [Source](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/diagrams/sequence-diagram.puml).

<!-- pagebreak -->

![Layered architecture](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics-foundation/docs/diagrams/architecture.svg)

*Figure 5. How do four layers connect?* [Source](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/diagrams/architecture.puml).

## 5. Implementation

Lifecycle: CREATED → CONFIRMED → PICKING → SHIPPED, then IN_TRANSIT and DELIVERED; CANCELLED from CREATED (no restock) or CONFIRMED (restock), rejected after PICKING. Customers cancel their own; staff cancel CONFIRMED.

| Design | Implementation | Verification |
|---|---|---|
| Guards: CREATED and sufficient stock | [order-api.ts:250–253](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/lib/order-api.ts#L250-L253), [276–280](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/lib/order-api.ts#L276-L280) | [Orders](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/tests/orders.integration.ts) |
| Serializable state, stock, ledger and notification writes | [order-api.ts:245–293](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/lib/order-api.ts#L245-L293) | [Orders](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/tests/orders.integration.ts) |
| driverId: assign only SHIPPED; retained after delivery | [driver-api.ts:44–51](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/lib/driver-api.ts#L44-L51); [transition](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/lib/order-api.ts#L321-L330) | [Driver](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/tests/driver.integration.ts) |
| Selected-date export | [admin/page.tsx:24–48](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/app/admin/page.tsx#L24-L48) | [Browser](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/scripts/browser-smoke.mjs#L385-L399) |

<!-- pagebreak -->

## 6. Verification and validation

Verification checks requirements against the implementation; validation exercises the delivered workflows through the interface. The [regression log](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/evidence/test-logs/2026-11-12-completeness-final/unit.log) and [CI](https://github.com/Et1enneee/comp3500-logistics/actions/runs/43175733067) show 38 unit, 140 integration, 2 delivery (driver simulation) and 26 browser checks.

| Boundary case | Observed | Test |
|---|---|---|
| Repeat confirmation | HTTP 409; state and stock unchanged | [Orders](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/tests/orders.integration.ts#L141-L156) |
| Stock equals demand | Confirmation succeeds; stock becomes zero | [Orders](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/tests/orders.integration.ts#L248-L252) |
| Stock 4 versus threshold 5 | Alert; stock 5 is not low | [Inventory](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/tests/inventory.integration.ts#L20-L38) |

Insufficient stock returns HTTP 409 with unchanged state and stock. In a local-loopback [measurement](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/evidence/performance.json) recorded on 11 November 2026, API p95 was 3.2–13.6 ms and first-contentful-paint p95 was 64–96 ms, against NFR-01 targets of at most 2 s and 3 s respectively. NFR-02 is evidenced by the recorded green build–test–browser runs ([observations](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/evidence/availability/integration-observations.json)).

## 7. Evolution

The early defect record drove confirmation and retest; the documentation hardening review corrected models and renewed tests. An administrator export task became three actions ([regression](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/evidence/test-logs/2026-11-12-completeness-final/browser.log)).

## 8. Validation

The [automated walkthrough](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/evidence/user-validation/automated-walkthrough.md) exercises eleven core operations through the interface as each of the four roles, at most three actions each, with expected outcomes asserted in the walkthrough script; results are logged with the run.

## 9. Feedback and reconciliation

**Table C. Feedback to evidence**

| Feedback | Disposition | Evidence |
|---|---|---|
| Diagrams | Corrected models and architecture | [Compliance matrix](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/diagrams/compliance.md) |
| FR-04 | Stock transition effects belong to FR-02 | [Traceability](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/traceability.md) |
| Increments | Triggers and outcomes | [Register](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/process/increments.md) |
| Admin task | Export re-tested; scripted walkthrough records the task (§8) | [Issue #15](https://github.com/Et1enneee/comp3500-logistics/issues/15) |
| Unit count | Two availability-summary regression tests added, bringing the suite to 38 | [Test history](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/evidence/test-logs/2026-11-12-completeness-final/unit.log) |
| NFR scope | Performance and availability criteria set for local single-warehouse deployment | [SRS revision log](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/requirements/srs.md#7-document-control) |

## 10. Evidence

[Traceability](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/traceability.md) · [Specification](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/requirements/srs.md) · [Evidence directory](https://github.com/Et1enneee/comp3500-logistics/tree/main/logistics-foundation/evidence) · [Baseline record](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/BASELINE-final-report.json).

Full evidence trail: [docs/final-report.md](https://github.com/Et1enneee/comp3500-logistics/blob/main/docs/final-report.md); baseline `6eb01afb1798c7361205b10597d80c0c26e8fdf6` (code, evidence and test logs).
