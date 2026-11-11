https://github.com/Et1enneee/comp3500-logistics

# COMP 3500SEF · Final Report

**Warehouse Logistics Management System**  
**Group 42:** Tang Yi Jie, Yin Pei Xu, Tang Chao, Yang Ting Zhang, Wu Peng Bo, Chung Ngon Man, Li Mu Qiu.

## 1. Scope

The goals are traceable order decisions and a role-separated workflow. Customers order and track; staff confirm, pick, ship and assign; drivers simulate assigned deliveries; administrators report. The local application serves one warehouse using Next.js, TypeScript, Prisma and SQLite. Real GPS, barcode scanning, recipient telephone collection, payment and carrier integration are outside scope. Operational constraints address deployment and data integrity.

## 2. Development process

Plan-driven incremental development defines each increment by its trigger and verified outcome; integration and continuous integration provide feedback. Product or specification changes form increments; evidence production belongs to hardening. The records establish development, not external delivery.

**Table A. Increment, trigger and outcome**

| Increment and date | Trigger | Outcome |
|---|---|---|
| Planning, 9 and 11 Oct 2026 | Project selection | Responsibilities and contracts recorded |
| Test-led review, 17 Oct 2026 | Assess order and stock functions | Defects recorded; drove confirmation |
| Confirmation, 26–28 Oct 2026 | Failed endpoint and missing ledger | Transaction verified |
| Integrated application, 1 Nov 2026 | Integrate foundation | Customer, staff and admin workflows |
| Driver and privacy, 2 Nov 2026 | Delivery and data minimisation | Assigned tasks and privacy checks |
| Documentation hardening, 10–11 Nov 2026 | Model and evidence review | Diagrams and traceability aligned |
| Export simplification, 11 Nov 2026 | Scripted walkthrough finding ([issue #15](https://github.com/Et1enneee/comp3500-logistics/issues/15)) | Selected-date export in three actions; regression passed |

Git manages versions, the [workflow](https://github.com/Et1enneee/comp3500-logistics/blob/main/.github/workflows/ci.yml) integrates changes, and the [issue tracker](https://github.com/Et1enneee/comp3500-logistics/issues) records problems. [Increment evidence](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/process/increments.md).

## 3. Requirements

The [software requirements specification](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/requirements/srs.md) is the specification. Functional requirements cover FR-01 order creation; FR-02 state changes; FR-03 numbering and tracking; FR-04 inventory and alerts; FR-05 notifications; FR-06 reports; FR-07 access control; FR-08 simulated delivery. Non-functional requirements cover NFR-01 performance; NFR-02 integration-point availability; NFR-03 least privilege; NFR-04 scripted operation effort; NFR-05 process quality.

**Table B. Risk coverage** ([risk matrix](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/requirements/risk-coverage.md))

| Risk | Addressed by | Treatment status |
|---|---|---|
| RK-01 | [Increment register](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/process/increments.md) | Managed — [scheduling plan](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/reference/legacy/risks.md) |
| RK-02 | FR-02, NFR-05 | Mitigated — [transition tests](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/lib/constants.test.ts) |
| RK-03 | [Priority register](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/reference/legacy/traceability-v0.md) | Managed — [scope priorities](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/reference/legacy/risks.md) |
| RK-04 | NFR-05 | Managed — [CI workflow](https://github.com/Et1enneee/comp3500-logistics/blob/main/.github/workflows/ci.yml) |
| RK-05 | FR-01/04/06, NFR-05 | Managed — [seed regression test](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/tests/seed.integration.ts) |
| RK-06 | [Risk plan](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/reference/legacy/risks.md) | Managed — [assessment schedule](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/reference/legacy/risks.md) |
| RK-07 | NFR-05 support | Managed — [setup guide](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/README.md) |
| RK-08 | [Risk plan](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/reference/legacy/risks.md) | Managed — [report and video plan](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/reference/legacy/risks.md) |

Mitigated records a mitigation; managed records a mechanism while the historical register remains open.

<!-- pagebreak -->

## 4. System models

Layered architecture separates pages, routes and authentication, business handlers, and persistence. Transactions preserve consistency without splitting this local warehouse into separate services. State and stock guards and transaction atomicity enforce hard rules.

![Figure 1. Order lifecycle: valid transitions and effects.](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics-foundation/docs/diagrams/state-machine.svg)

*Figure 1. Order lifecycle: valid transitions and effects.* [Source](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/diagrams/state-machine.puml).

<!-- pagebreak -->

![Figure 2. Use cases associate external roles with application functions.](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics-foundation/docs/closure/usecase.svg)

*Figure 2. Use cases associate external roles with application functions.* [Source](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/closure/usecase.puml).

<!-- pagebreak -->

An order has 0..* items in the schema, while creation requires at least one; an item references one product. An order has 0..1 shipment; a product has 0..* inventory logs.

![Figure 3. Entity relationships and multiplicities.](https://raw.githubusercontent.com/Et1enneee/comp3500-logistics/main/logistics-foundation/docs/er.svg)

*Figure 3. Entity relationships and multiplicities.* [Source](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/er.puml).

## 5. Implementation

The confirmation guard ([order-api.ts:250–253](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/lib/order-api.ts#L250-L253)) requires CREATED; the stock guard ([order-api.ts:276–280](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/lib/order-api.ts#L276-L280)) requires sufficient quantity. The [serializable transaction](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/lib/order-api.ts#L245-L293) groups state, stock, ledger and notification writes. [Staff cancellation](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/lib/order-api.ts#L420-L435) requires CONFIRMED. A driver is [assigned only to SHIPPED orders](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/lib/driver-api.ts#L44-L51); the [assignment remains after delivery](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/lib/order-api.ts#L321-L330).

## 6. Verification and validation

Verification checks the specification; validation assesses fitness for real users. The recorded run passed 38 unit, 140 integration, 2 delivery and 26 browser checks; [logs](https://github.com/Et1enneee/comp3500-logistics/tree/main/logistics-foundation/evidence/test-logs/2026-11-11-reconciliation) and [CI](https://github.com/Et1enneee/comp3500-logistics/actions/runs/43001010576) provide evidence. Repeated confirmation and insufficient stock return HTTP 409 with unchanged state and stock. In a pre-export-fix local-loopback measurement, API p95 was 3.2–13.6 ms and first-contentful-paint p95 was 64–96 ms, against NFR-01 targets of at most 2 s and 3 s respectively ([measurement](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/evidence/performance.json)). The revised availability criterion records 40 successful build–test–browser integration points ([observations](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/evidence/availability/integration-observations.json)).

<!-- pagebreak -->

## 7. Evolution

The early defect record led to the confirmation transaction and its retest. The post-presentation audit led to corrected models and renewed tests. The walkthrough exposed a four-action administrator task; direct export now takes three actions including date entry, or one click from a prepared screen ([regression](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/evidence/test-logs/2026-11-11-reconciliation/browser.log)).

## 8. Validation

The [automated walkthrough](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/evidence/user-validation/automated-walkthrough.md) counts at most three scripted actions for each of eleven selected operations from prepared screens (excluding login, navigation and recovery). The [human protocol](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/user-validation/moderator.md) defines role tasks, completion, errors, help requests and time, with acceptance criteria defined before each run. Participant observation is planned for 17–24 November.

## 9. Feedback and reconciliation

**Table C. Feedback to evidence**

| Feedback | Disposition | Evidence |
|---|---|---|
| Diagrams | Corrected state and use-case models | [Audit](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/audit-2026-11-10.md) |
| FR-04 | Stock transition effects belong to FR-02 | [Traceability](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/traceability.md) |
| Increments | Defined triggers and outcomes | [Register](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/process/increments.md) |
| Presentation p95 | Evidence file governs; the presentation figure has no tracked measurement in any baseline | [Measurement](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/evidence/performance.json) |
| Admin task | Direct export re-tested; participant observation planned (§8) | [Issue #15](https://github.com/Et1enneee/comp3500-logistics/issues/15) |
| Unit count | Two soak-summary tests increased the count from 36 to 38 | [Test history](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/scripts/soak-summary.test.mjs) |
| NFR scope | Criteria revised for local deployment | [SRS revision log](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/requirements/srs.md#7-document-control) |

The matrices and increment records connect decisions to implementation and evidence.

## 10. Evidence

[Traceability](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/traceability.md) · [Specification](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/docs/requirements/srs.md) · [Evidence directory](https://github.com/Et1enneee/comp3500-logistics/tree/main/logistics-foundation/evidence) · [Baseline record](https://github.com/Et1enneee/comp3500-logistics/blob/main/logistics-foundation/BASELINE-final-report.json).

Full evidence trail: [docs/final-report.md](https://github.com/Et1enneee/comp3500-logistics/blob/main/docs/final-report.md) in the repository (evidence baseline `7f161031313ffa0cf43efb1fdedf71c220ef220f`).
