# COMP 3500 Final Report — Warehouse Logistics Management System

Repository: [Et1enneee/comp3500-logistics](https://github.com/Et1enneee/comp3500-logistics). Markdown links resolve from this report. Code and test paths such as `lib/` and `tests/` are relative to the application directory `logistics-foundation/`; CI and other explicitly root-relative paths are relative to the repository root.

## 1. Introduction and scope

The project has two goals: make the decisions affecting an order traceable from requirement to implementation and test; and provide a coherent workflow separated by user role. The application uses Next.js, TypeScript, Prisma and SQLite to manage a single warehouse, inventory, orders and simulated delivery on a local deployment.

| Role | Responsibility |
|---|---|
| Customer | Place and track own orders; read notifications and cancel eligible orders. |
| Staff | Confirm, pick and ship orders, manage inventory and assign drivers. |
| Driver | View assigned deliveries and simulate pickup and delivery. |
| Admin | View operational reports and export aggregates. |

The primary stakeholders are these user roles; operational concerns such as deployment and data integrity are addressed by the constraints in §3. The «system» boundary contains the local application and its database; the four users interact with the application as external actors. Real GPS, payment and carrier integration are outside the defined scope. See [driver module](../logistics-foundation/docs/driver-module.md) and [scope record](../logistics-foundation/docs/closure/scope-and-srs-addendum.md).

## 2. Development process

The project is presented as plan-driven incremental development: each increment has a trigger, scope and exit criterion, with short feedback cycles and continuous integration inside the increments. The records establish integration and verification, rather than release to external users. The descriptions and exit criteria below are reconstructed from surviving artefacts; the [increment register](../logistics-foundation/docs/process/increments.md) identifies their evidence.

**Table 2.1 — Increment definitions**

| Increment | Trigger | Scope | Exit criterion | Evidence |
|---|---|---|---|---|
| Project planning | Logistics project selection | Define responsibilities, contracts and initial order-management scope. | Record contracts and requirement IDs. | [Change log](../repo-init/CHANGELOG.md); [initial README](../repo-init/README.md) |
| Early test-led review | Initial order and inventory functionality needed assessment. | Execute cases for creation, transitions, tracking and alerts, and record discrepancies. | Record actual outcomes against cases. | [Historical defect record](../logistics-foundation/docs/reference/legacy/Jaden-defects.md) |
| Order confirmation behind the HTTP interface | The early defect record identifies a failed confirmation endpoint and missing ledger. | Confirm a created order through the HTTP status route, reserving stock and recording the ledger within a transaction. | Record a successful confirmation and a rejected repeat with database observations. | [Order query and confirmation verification record (订单查询与确认功能验证记录)](../logistics-foundation/docs/verification-original-1026.md); `git show 0d9f400` |
| Integrated role-based application | Integrate the verified foundation into an application. | Combine customer ordering, staff operations and administrative reporting with authenticated access. | Preserve the integrated source and version record. | `git show f2693fd`; [version record](../logistics-foundation/BASELINE-v0.4.2.json) |
| Simulated driver delivery and staff privacy | Delivery assignment and address minimisation required implementation. | Add assigned delivery tasks and minimise customer address data exposed to staff. | Integrate driver and privacy tests. | [Driver module](../logistics-foundation/docs/driver-module.md); `tests/driver.integration.ts` |
| Post-presentation documentation hardening | Review found differences among models, requirements records and implementation. | Align diagrams and traceability with code and regenerate verification evidence. | Record the changes and test results against an identified baseline. | [Audit](../logistics-foundation/docs/audit-2026-11-10.md); §10 |

Configuration management has three components. **Version management** uses Git; the annotated `v0.3.1` and `v0.4.2` tags were applied retrospectively. **System integration** uses the [repository-root CI workflow](../.github/workflows/ci.yml), triggered for the named push branches, pull requests and manual runs. **Problem tracking** uses the [known-issues register](../logistics-foundation/docs/known-issues.md) and [incident record](../evidence/incident-reports/ci-concurrency-cancellations.md).

## 3. Requirements

The surviving risk register, historical requirement register and development evidence support an auditable reconstruction of the requirements; see the [closure record](../logistics-foundation/docs/closure/README.md), [audit](../logistics-foundation/docs/audit-2026-11-10.md) and [traceability matrix](../logistics-foundation/docs/traceability.md). The source labels below identify the evidence used in this reconstruction.

### Customer

- **FR-01 — Create orders.** The system shall let a customer create an order containing product lines and a total. *This creates the entry point to the warehouse workflow.* Source: scope decision, [historical register](../logistics-foundation/docs/reference/legacy/traceability-v0.md).
- **FR-03 — Number and track orders.** The system shall generate order and shipment identifiers and show an owner their order and tracking history. *Identifiers support retrieval of progress.* Source: scope decision, historical register.
- **FR-05 — In-app notifications.** The system shall record notifications for defined order events and let the customer inspect and mark them as read. *Notifications communicate recorded progress.* Source: scope decision, historical register.

### Staff

- **FR-02 — Order state changes.** The system shall enforce the order lifecycle, including confirmation and eligible cancellation, with stock reservation or release as specified in §4. *Controlled transitions protect inventory and order history.* Source: QA findings, [verification record](../logistics-foundation/docs/verification-original-1026.md).
- **FR-04 — Inventory and alerts.** The system shall provide inventory information, replenishment, ledger views and a low-stock alert when available stock is below the product threshold. *Stock visibility supports replenishment decisions.* Source: scope decision, historical register.

### Driver

- **FR-08 — Simulated delivery.** The system shall let staff assign a shipped order and let an assigned driver view the task and simulate pickup and delivery. *Assignment provides a bounded delivery handoff.* Source: scope decision, [driver module](../logistics-foundation/docs/driver-module.md).

### Admin and shared access

- **FR-06 — Operational reports.** The system shall provide an administrator with aggregate order reports and CSV export. *Aggregates support operational review.* Source: scope decision, historical register.
- **FR-07 — Access control.** The system shall authenticate users and enforce role and object-level access to applicable functions and records. *Access checks limit unauthorised operations.* Source: scope decision, historical register.

**Non-functional requirements.** The conditions and verification methods are recorded in the [current traceability matrix](../logistics-foundation/docs/traceability.md) and [historical register](../logistics-foundation/docs/reference/legacy/traceability-v0.md).

| ID | Requirement, conditions and target | Measure / status |
|---|---|---|
| NFR-01 Performance | The system shall respond to core queries within 2 s and show list first paint within 3 s. These are subcriteria of one requirement. | Measure HTTP response and actual first paint; §6 reports the separate first-row/card proxy. |
| NFR-02 Availability | The system shall remain available during the daily 08:00–24:00 teaching period. | Record uptime across the defined period; protocol in §8. |
| NFR-03 Least privilege | The system shall restrict operations and record visibility to authorised roles and users. | Execute role, object-ownership and privacy tests against expected HTTP responses and fields. |
| NFR-04 Usability | The system shall support core operations in at most three major actions per screen. | Observe representative users and count actions, errors and help requests (§8). |
| NFR-05 Process quality | The project shall apply code checks, contracts and continuous integration to the configured branches and pull requests. | Inspect workflow outcomes and the manifest verification step. |

Must and Should priorities in the historical register express the project's scope priorities; the reconstructed rationales link essential workflow and access needs to the risk register and supporting records. They are shared by multiple requirements, not exclusive to inventory.

**Table 3.1 — Risk-to-requirement coverage**

The complete five-column register, including severity and historical status, is [risk-coverage.md](../logistics-foundation/docs/requirements/risk-coverage.md). Its relationships are reconstructed from the [risk register](../logistics-foundation/docs/reference/legacy/risks.md).

| Risk and severity (probability/impact) | Addressed by | Mitigation | Verification | Status |
|---|---|---|---|---|
| RK-01 Scheduling mismatch, medium/high | Process | Checkpoints and defined work | Risk register; Table 2.1 | Open in register |
| RK-02 Uncoordinated contract changes, medium/high | FR-02, NFR-05 | Central transition table and checks | `lib/constants.test.ts`; CI | Mitigated in register; model corrections in audit |
| RK-03 Assessment-week capacity, high/medium | Process | Prioritise core chain | Risk and historical priority registers | Open in register |
| RK-04 Local setup or CI delay, low/medium | NFR-05 | Setup commands and CI | Workflow; `package.json` | Open in register |
| RK-05 Demo data reproducibility, low/high | FR-01/04/06; NFR-05 | Guarded deterministic seed | `prisma/seed.ts`; `tests/seed.integration.ts` | Historical mitigation reconciled; open in register |
| RK-06 Competing assignments, high/high | Process | Schedule around assessment peaks | Risk register | Open in register |
| RK-07 Stack learning curve, high/medium | NFR-05 supporting tooling | Setup guide and checks | README; workflow | Open in register |
| RK-08 Report and video schedule, medium/high | Process | Freeze and rehearse demonstration | Risk register | Open in register |

**Table 3.2 — Requirements review checks**

| Check | Review conclusion and evidence |
|---|---|
| Validity | Role workflows correspond to implemented functions; stakeholder acceptance is planned in §8. |
| Consistency | Current transition table and code agree; historical model differences are reconciled in §9. |
| Completeness | The surviving register covers the listed scope; the closure record identifies the missing original SRS. |
| Realism | The implemented workflow runs as a local, single-warehouse application with simulated delivery. |
| Verifiability | Requirement IDs map to test files or named planned measurements in [traceability](../logistics-foundation/docs/traceability.md). |

## 4. System models

### Use cases and state machine

The [use-case source](../logistics-foundation/docs/closure/usecase.puml) and [rendered diagram](../logistics-foundation/docs/closure/usecase.svg) associate each actor with goals; sign-in is a separate use case.

![Role-based use cases](../logistics-foundation/docs/closure/usecase.svg)

The [state-machine source](../logistics-foundation/docs/diagrams/state-machine.puml) and [rendered diagram](../logistics-foundation/docs/diagrams/state-machine.svg) follow `lib/constants.ts:25–33`.

![Order state machine](../logistics-foundation/docs/diagrams/state-machine.svg)

| State | Meaning |
|---|---|
| CREATED | The order exists and awaits confirmation or eligible cancellation. |
| CONFIRMED | Stock has been reserved for the order. |
| PICKING | Staff are preparing the confirmed order. |
| SHIPPED | A shipment exists and awaits simulated pickup. |
| IN_TRANSIT | Simulated pickup has occurred. |
| DELIVERED | Simulated delivery has been recorded. |
| CANCELLED | The order was cancelled under the eligible-state rules. |

| Transition | Trigger and guard | Effect |
|---|---|---|
| CREATED → CONFIRMED | Staff confirmation; sufficient stock. | Atomically change state, decrement stock, record per-product ledger entries and create notification. |
| CREATED → CANCELLED | Owner cancels own created order. | Change state and create notification; no stock release or release ledger. |
| CONFIRMED → PICKING | Staff starts picking. | Change state. |
| CONFIRMED → CANCELLED | Owner or staff cancels a confirmed order. | Restore reserved quantities and record release ledger entries and notification atomically. |
| PICKING → SHIPPED | Staff creates a shipment for a picking order. | Create shipment and tracking information. |
| SHIPPED → IN_TRANSIT | Staff or assigned driver simulates pickup. | Update order and shipment, tracking event and notification. |
| IN_TRANSIT → DELIVERED | Staff or assigned driver simulates delivery. | Update order and shipment, tracking event and notification. |

Cancellation from PICKING or a later state returns HTTP 409; a customer attempting to cancel another customer's order receives HTTP 404. Staff cancellation is restricted to CONFIRMED. Assignment is allowed while the order is SHIPPED. The assigned `driverId` remains on delivery as historical assignment; the schema's `onDelete: SetNull` applies if the related user is deleted. The legal transition table has no self-loop. See `lib/order-api.ts:217–239,302–435`, `lib/driver-api.ts:31–51` and `prisma/schema.prisma:99–110`.

### Rules and data

Hard rules include state and stock guards and transactional atomicity. A rejected transition or stock reservation produces HTTP 409 and the transaction rolls back. The low-stock threshold is a configurable operational rule: the default is five and an alert uses strict less-than comparison. In-app notification persistence participates in the same transaction as the business event; reading the notification is a separate user action. See `lib/order-api.ts:248–292`, `lib/notify.ts:14–36` and `prisma/schema.prisma:54–61`.

The [ER source](../logistics-foundation/docs/er.puml) and [rendering](../logistics-foundation/docs/er.svg) derive multiplicities from `prisma/schema.prisma`. An Order has zero or more OrderItems at schema level; the order-creation API requires at least one item (`lib/create-order.ts:14–17`). Each OrderItem references exactly one Order and one Product; a Product may occur in zero or more OrderItems. An Order has zero or one Shipment, each Shipment has exactly one Order, and a Product has zero or more InventoryLogs. The assigned driver is optional on a Shipment; each User may have zero or more assigned Shipments.

![Entity relationships](../logistics-foundation/docs/er.svg)

The [confirmation sequence source](../logistics-foundation/docs/diagrams/sequence-diagram.puml) and [rendering](../logistics-foundation/docs/diagrams/sequence-diagram.svg) show `PATCH(req, context)` → `updateStatus(req, id)` → `confirmOrder(id, actorId)` → a transaction, with commit/HTTP 200 and rollback/HTTP 409 alternatives.

![Confirmation sequence](../logistics-foundation/docs/diagrams/sequence-diagram.svg)

### Architecture

**Layered architecture** organises responsibilities into layers with interfaces: role-specific pages → HTTP routes and authentication → order, inventory and driver business handlers → Prisma and SQLite persistence. Layer boundaries permit focused testing, while transactions keep state and inventory changes together. MVC, Repository and Client–server describe other organisational emphases; a separate service deployment is unnecessary for this local single-warehouse scope. See [driver architecture](../logistics-foundation/docs/driver-module.md) and the code mapping below.

## 5. Implementation

**Table 5.1 — Design to implementation**

| Design element (§4) | Code element | Verification |
|---|---|---|
| HTTP status entry | `app/api/v1/orders/[id]/status/route.ts:6–9`; `lib/order-api.ts:217–239` | `tests/orders.integration.ts` |
| Legal state transitions | `lib/constants.ts:25–36`; `lib/order-api.ts:302–315` | `lib/constants.test.ts`; `tests/logistics-chain.integration.ts` |
| Confirmation transaction | `lib/order-api.ts:245–293`; `lib/notify.ts:19–36` | `tests/orders.integration.ts`; `tests/notifications.integration.ts` |
| Cancellation branches | `lib/order-api.ts:367–435` | `tests/cancel.integration.ts` |
| Driver assignment and visibility | `lib/driver-api.ts:5–18,31–53`; `prisma/schema.prisma:99–112` | `tests/driver.integration.ts`; `tests/address.integration.ts` |
| Inventory threshold | `prisma/schema.prisma:54–61`; `lib/inventory-api.ts` | `tests/inventory.integration.ts` |
| Order, items and shipment relations | `prisma/schema.prisma:67–112`; `lib/create-order.ts:14–17` | `tests/foundation.integration.ts`; `tests/logistics-chain.integration.ts` |

The confirmation state guard is `where: { id, status: "CREATED" }` (`lib/order-api.ts:250–253`); the inventory guard is `where: { id: productId, stock: { gte: quantity } }` (`:276–280`). A serializable transaction encloses the claim, stock decrement, ledger and notification (`:248–292`); a failed guard rejects the operation and rolls back its writes. The cancellation handler permits staff to cancel only CONFIRMED orders (`:373–388,431–434`). The delivery transition leaves the shipment's `driverId` intact (`:302–353`), preserving the assignment.

## 6. Verification and validation

Verification asks whether the product was built in accordance with its specification. Validation asks whether it meets real users' needs; §8 defines the planned user validation.

The test strategy uses unit tests for individual rules and helpers, component/integration tests for handlers and isolated SQLite interactions, and system-level delivery and browser checks for the integrated application. The recorded run passed 36 unit tests, 140 component/integration cases across 14 files, 2 delivery checks and 25 browser checks; the commands and logs appear in §10. The browser suite exercises the UI, API and database together.

**Table 6.1 — Requirement to verification**

| Requirement | Test file(s) | Behaviour asserted |
|---|---|---|
| FR-01 | `tests/foundation.integration.ts` | Order creation, validation and stock pre-check. |
| FR-02 | `tests/orders.integration.ts`, `tests/cancel.integration.ts`, `tests/logistics-chain.integration.ts` | Guards, reservation, cancellation and lifecycle. |
| FR-03 | `tests/logistics-chain.integration.ts` | Order/shipment identifiers and tracking events. |
| FR-04 | `tests/inventory.integration.ts` | Inventory, replenishment and strict alert threshold. |
| FR-05 | `tests/notifications.integration.ts` | Customer notification scope and duplicate prevention. |
| FR-06 | `tests/reports.integration.ts` | Report aggregates, filters, CSV and access. |
| FR-07 | `tests/auth.integration.ts`, `tests/privacy.integration.ts`, `tests/address.integration.ts` | Authentication, role/object boundaries and data minimisation. |
| FR-08 | `tests/driver.integration.ts`, `tests/driver-demo.integration.ts` | Assigned delivery and opt-in demo driver. |
| Cross-cutting | `tests/query.integration.ts`, `tests/seed.integration.ts` | Query validation and demo seed timestamps. |

**Table 6.2 — Boundary cases, expected and observed**

| Case | Expected | Observed in the named test |
|---|---|---|
| Repeat confirmation | HTTP 409, with no second decrement or ledger entry. | `orders.integration.ts`: first HTTP 200, repeat 409 and unchanged snapshot. |
| A later product is short of stock | HTTP 409 and rollback of all order, stock and ledger writes. | `orders.integration.ts`: 409 and unchanged snapshot. |
| Stock equals requested quantity | Confirmation succeeds and stock reaches zero. | `orders.integration.ts`: HTTP 200 and zero stock. |
| Stock 4 against threshold 5; stock 5 against threshold 5 | First item is low; second is not. | `inventory.integration.ts`: strict comparison includes the first and excludes the second. |
| Pagination inputs `0x10`, `Infinity`, `9007199254740992` | Reject values outside the accepted decimal/safe-integer range. | `query.integration.ts`: each is rejected by parsing assertions. |

The CI workflow installs dependencies, checks the source manifest, creates a disposable database, runs tests, build, performance probe and browser checks. The manifest check verifies that the recorded file hashes match the checked-out source. Historical run [41757351466](https://github.com/Et1enneee/comp3500-logistics/actions/runs/41757351466) stopped on a mismatch for `docs/traceability.md`; the later [main run](https://github.com/Et1enneee/comp3500-logistics/actions/runs/41758556769) succeeded. Current branch run and command output appear in §10.

**Performance environment.** Measurements in §10 use a production build on a local loopback deployment with sequential requests and a warmed Chromium browser, as recorded by the performance probe. The API p95 across the measured endpoints was 3.7–15.2 ms; the UI p95 for navigation to the first visible row or card was 157.4–185.5 ms. Sample sizes, values and commands are in §10. Actual first paint and representative deployment measurements are planned in §8.

## 7. Evolution

**Measured → analysed → changed → re-measured.** The historical early test record measured a missing confirmation endpoint and ledger; the confirmation increment implemented the HTTP transaction, and the later verification record captured a successful request and a rejected repeat. Separately, the post-presentation audit compared code, models and evidence; the hardening increment changed diagrams and traceability, and §10 records the re-run. The [known-issues register](../logistics-foundation/docs/known-issues.md) provides a continuing record of risks and limitations. Future work is planned in §8.

## 8. Planned user validation

The protocol is defined before execution; acceptance criteria are set before the run. The next iteration will recruit representative users for the roles and record completion, errors, help requests and elapsed time. A facilitator will record each attempt and the user will perform the task without implementation-specific coaching.

| Role | Acceptance task | Acceptance criterion | Measures |
|---|---|---|---|
| Customer | Create an order, locate it and review its progress. | The order and progress are found, with correct line items and status. | Completion, errors, help requests, time and major actions. |
| Staff | Confirm, pick and ship an eligible order and assign a driver. | The order reaches SHIPPED, stock/ledger match the order and a driver is assigned. | Completion, errors, help requests, time and major actions. |
| Driver | Find the assigned order and simulate pickup and delivery. | The assigned order reaches DELIVERED and tracking records the events. | Completion, errors, help requests, time and major actions. |
| Admin | Filter a report and export it. | The selected period and exported aggregates match the displayed values. | Completion, errors, help requests, time and major actions. |

Further verification will measure actual first paint and performance in a representative deployment, observe availability over the NFR-02 period, assess broader privacy threats and address the [known issues](../logistics-foundation/docs/known-issues.md). Confirm the current report-length requirement against the official course materials before preparing the submission version; the [historical register](../logistics-foundation/docs/reference/legacy/risks.md) records a length limit for verification. Any future code refactoring will preserve observable behaviour and be followed by named regression tests and refreshed §7/§10 evidence.

## 9. Feedback incorporated and reconciliation

**Table 9.1 — Feedback and evidence**

| Review or presentation statement | Meaning | Disposition | Evidence |
|---|---|---|---|
| “Some of diagrams are incorrect. Role-based design is clear.” | Review calls for correct models while retaining distinct roles. | State and use-case sources corrected and exported; test results tied to the hardened baseline. | §4; [audit](../logistics-foundation/docs/audit-2026-11-10.md); §10. |
| Increment definition unclear (oral feedback) | Readers need trigger, scope, exit criteria and evidence. | Defined each increment in full sentences. | Table 2.1; [increment register](../logistics-foundation/docs/process/increments.md). |
| Presentation FR-04 describes confirmation deduction and cancellation release. | Inventory effects accompany state changes. | FR-02 governs state transitions and their effects; FR-04 governs inventory management and low-stock alerts. Must priority is shared by several IDs. | §3; [traceability](../logistics-foundation/docs/traceability.md). |
| Presentation p95 18.2 ms; prior assertion API p95 1.9–3.2 ms. | Different reported performance figures require provenance. | The baseline tree has no tracked performance file at the asserted path; the historical CI artifact is retained separately, and §10 reports the new measured result. The cause of the discrepancy is unestablished. | [Audit](../logistics-foundation/docs/audit-2026-11-10.md); [historical CI measurement](../logistics-foundation/evidence/history/41758556769/performance.json); §10. |
| Previous state diagram: SHIPPED → DELIVERED and cancellation self-loop. | A rejected operation was represented as a transition and IN_TRANSIT omitted. | Use the seven legal transitions from code; show rejection separately. | [State source](../logistics-foundation/docs/diagrams/state-machine.puml); `lib/constants.ts:25–33`. |
| Previous use-case diagram: cancellation pending and driver absent. | The historical model did not represent current role capabilities. | Add Driver and implemented cancellation; connect sign-in independently. | [Use-case source](../logistics-foundation/docs/closure/usecase.puml). |
| Previous confirmation sequence: POST `/confirm`. | The model used a historical endpoint rather than the current status route. | Show `PATCH` and function-level transaction calls. | [Sequence source](../logistics-foundation/docs/diagrams/sequence-diagram.puml); status route. |
| RK-05: historical seed mitigation says 50 orders. | The old target and current executable seed describe different data shapes. | Preserve the historical row; document the current 56-order seed. | [Risk register](../logistics-foundation/docs/reference/legacy/risks.md); `prisma/seed.ts`. |
| Integrated application described as a four-role increment. | The driver role was added after the integrated application commit. | Describe the three-role application and subsequent driver increment separately. | `git show f2693fd:logistics-foundation/prisma/schema.prisma`; Table 2.1. |
| Earlier planning date and HTTP test date. | Claimed planning date and early test record require distinct evidence. | Use the recorded planning entries and distinguish the early test record from the later HTTP record. | [Audit](../logistics-foundation/docs/audit-2026-11-10.md); [change log](../repo-init/CHANGELOG.md). |
| Root README traceability path. | An application-relative link from the root README requires the application-directory prefix. | Added the correct repository-root link. | [README](../README.md); [traceability](../logistics-foundation/docs/traceability.md). |
| Workflow path and Node version. | CI is a repository-root workflow and specifies Node 24. | Use root-relative paths and record the local Node version in §10. | [Workflow](../.github/workflows/ci.yml); `node -v`. |

The risk matrix, increment table and reconciliation table make the development process visible from a defined need through design, implementation and evidence.

## 10. Evidence appendix

### Traceability

The complete requirement-to-code and verification mapping, including sources and rationales, is [traceability.md](../logistics-foundation/docs/traceability.md). Table 6.1 provides the report's concise mapping; [risk coverage](../logistics-foundation/docs/requirements/risk-coverage.md) relates the risk register to requirements and process risks.

The following is the complete current traceability table. Code and evidence paths in its cells are relative to `logistics-foundation/`.

| ID | Original Requirement/Priority | Current Implementation | Primary Evidence | Status | Source | Rationale |
|---|---|---|---|---|---|---|
| FR-01 | Order creation, Must | `POST /api/v1/orders`, customerId from the session, stock pre-check without deduction, price snapshot | `tests/foundation.integration.ts`; browser 01–02 | Implemented | Scope decision ([legacy register](../logistics-foundation/docs/reference/legacy/traceability-v0.md)) | *Orders are the entry point for the warehouse workflow.* |
| FR-02 | Status transitions and cancellation, Must | confirm/pick/ship/pickup/delivery + cancel (CREATED no restock / CONFIRMED restocks once); rejected after PICKING | `tests/orders.integration.ts`, `tests/logistics-chain.integration.ts`, `tests/cancel.integration.ts` | Implemented | QA findings ([verification record](../logistics-foundation/docs/verification-original-1026.md)) | *Controlled state changes protect stock and order history.* |
| FR-03 | Numbering and tracking, Must | unique ORD/LG numbering; customer self-service order center and timeline; cross-customer 404 | `tests/logistics-chain.integration.ts`; browser 03–04, 09 | Implemented | Scope decision ([legacy register](../logistics-foundation/docs/reference/legacy/traceability-v0.md)) | *Stable identifiers let customers retrieve order and shipment progress.* |
| FR-04 | Inventory and low-stock alerts, Must | available-stock semantics; negative ledger on confirm, positive release on cancel, positive replenishment; strict `stock<threshold`; separate alert area and ledger page | `tests/inventory.integration.ts`, `tests/cancel.integration.ts`; browser 16–18 | Implemented | Scope decision ([legacy register](../logistics-foundation/docs/reference/legacy/traceability-v0.md)) | *Stock visibility and alerts support replenishment decisions.* |
| FR-05 | In-app notifications, Should | five business event types generated within transactions; (orderId,type) unique; unread count/mark-as-read | `tests/notifications.integration.ts`; browser 10 | Implemented | Scope decision ([legacy register](../logistics-foundation/docs/reference/legacy/traceability-v0.md)) | *Notifications inform customers of recorded order events.* |
| FR-06 | Operational reports, Should | ADMIN read-only aggregates, GMT+8 date range, CSV export | `tests/reports.integration.ts`; browser 11 | Implemented | Scope decision ([legacy register](../logistics-foundation/docs/reference/legacy/traceability-v0.md)) | *Aggregated reports support operational review.* |
| FR-07 | Users/roles/auth, Must | scrypt passwords, Session + HttpOnly cookie, CSRF, rate limiting, 401/403/404 boundaries | `tests/auth.integration.ts`; `lib/auth.ts`, `lib/http.ts` | Implemented | Scope decision ([legacy register](../logistics-foundation/docs/reference/legacy/traceability-v0.md)) | *Authentication and role checks protect workflow access.* |
| FR-08 | Simulated driver assignment and delivery, team scope | Staff assigns a shipped order; driver sees assigned tasks and advances simulated pickup/delivery | `tests/driver.integration.ts`; `scripts/browser-smoke.mjs` | Implemented as a simplified increment; GPS, scanning and recipient phone not implemented | Scope decision ([driver module](../logistics-foundation/docs/driver-module.md)) | *Assigned delivery tasks extend the simulated fulfilment workflow.* |
| NFR-01 | Core queries ≤2s, list first paint ≤3s, Must | production build, 30 API samples, 3 UI samples | `evidence/performance.json`; `evidence/test-logs/2026-11-11/performance.log` | Core-query local p95 target met; first-row/card is a proxy, with first paint planned | Scope decision ([legacy register](../logistics-foundation/docs/reference/legacy/traceability-v0.md)) | *Response targets make interactive use measurable.* |
| NFR-02 | Available 08:00–24:00 daily, Must | no long-term run | — | Not verified (short tests are not a substitute) | Scope decision ([legacy register](../logistics-foundation/docs/reference/legacy/traceability-v0.md)) | *Availability during the teaching day supports planned use.* |
| NFR-03 | Least privilege, Must | role matrix + object-level 404; staff order responses omit customer identity, customer ID and delivery address; customer actors in inventory logs are anonymized | `tests/auth.integration.ts`, `tests/orders.integration.ts`, `tests/privacy.integration.ts`, `tests/address.integration.ts` | Implemented for the current simulated workflow | Scope decision ([legacy register](../logistics-foundation/docs/reference/legacy/traceability-v0.md)) | *Least privilege limits disclosure and unauthorised operations.* |
| NFR-04 | Core operations ≤3 steps, Should | customer order placement, staff confirm/ship etc. fit within ≤3 major actions per screen; no formal timed walkthrough | browser script steps | Partial (not formally accepted) | Scope decision ([legacy register](../logistics-foundation/docs/reference/legacy/traceability-v0.md)) | *Short workflows support usable core operations.* |
| NFR-05 | Code standards/contracts/CI, Must | typecheck/lint/unit/integration/build/browser all executable; root CI configuration complete | repository-root `.github/workflows/ci.yml`; `evidence/test-logs/2026-11-11/`; [main CI run](https://github.com/Et1enneee/comp3500-logistics/actions/runs/41758556769) | Local unit, integration, delivery, build and browser checks passed; CI results are commit-specific | Risk register ([RK-04](../logistics-foundation/docs/reference/legacy/risks.md)) | *Automated checks provide repeatable integration evidence.* |

### Baseline and reproduction

- Presentation baseline: `df340dc4c6c10236040bae672f2c518f1678033d`; historical [CI run 41758556769](https://github.com/Et1enneee/comp3500-logistics/actions/runs/41758556769).
- Hardened baseline: **`5147f279a2c69cd56d86fc943f89e41ce9d87f7f`**. The [baseline record](../logistics-foundation/BASELINE-final-report.json) distinguishes the tested source commit, the evidence commit and the subsequent report commit.
- Annotated tags `v0.3.1` and `v0.4.2` point to `0d9f400` and `f2693fd` respectively; both tag messages state “applied retrospectively”. Reproduce with `git for-each-ref --format='%(refname:short) %(objecttype) %(*objectname) %(contents:subject)' refs/tags`.
- Run from repository root after `npm run setup` and `npm run db:setup`; seed only a disposable database using `RESET_DEMO_DATA=YES npm run db:seed:demo`. Commands and raw output: [dated logs](../logistics-foundation/evidence/test-logs/). The browser run requires a running local production server, `FOUNDATION_BROWSER_TEST=YES`, `FOUNDATION_BASE_URL=http://127.0.0.1:3100`, and an available Chromium; see [test plan](../logistics-foundation/docs/test-plan.md).

**Local verification:** On 2026-11-11 the tested source was `d3a25b0089a02c24d1942208e8eeddc57f5f8709`. From `logistics-foundation/`, `npm test` passed 36 unit tests; `npm run test:integration` passed 140 cases across 14 files; `npm run test:delivery` passed 2 checks; `npm run build` succeeded; and `npm run test:browser` passed 25 checks. The [dated logs](../logistics-foundation/evidence/test-logs/2026-11-11/) record commands, exit codes and timestamps. The evidence baseline adds those logs and documentation after the tested source commit; its successful CI run independently tested that later commit.

For reproduction, use a fresh clone and a disposable SQLite database; the seed resets demo data. The following runs the application and tests from the repository root. The fresh clone uses `logistics-foundation/prisma/dev.db`; choose an available port and do not run the seed against a database containing data to keep:

```sh
git clone https://github.com/Et1enneee/comp3500-logistics.git
cd comp3500-logistics
git checkout 5147f279a2c69cd56d86fc943f89e41ce9d87f7f
export DEMO_PASSWORD='Demo1234!'
npm run setup
npm run db:setup
RESET_DEMO_DATA=YES npm run db:seed:demo
npm test
npm run test:integration
npm run test:delivery
npm run build
# In a separate terminal, retain DEMO_PASSWORD:
npm --prefix logistics-foundation run start -- --hostname 127.0.0.1 --port 3100
# Once the server is ready, in the original terminal:
FOUNDATION_BROWSER_TEST=YES FOUNDATION_BASE_URL=http://127.0.0.1:3100 CHROMIUM_PATH="$(command -v chromium)" npm run test:browser
```

Use `find logistics-foundation/tests -maxdepth 1 -name '*.integration.ts' | wc -l` to count integration files; `rg 'tests |pass ' logistics-foundation/evidence/test-logs/2026-11-11/{integration,delivery}.log` and `rg 'passed|Browser acceptance' logistics-foundation/evidence/test-logs/2026-11-11/{unit,browser}.log` inspect recorded counts. `git rev-parse HEAD`, `git log --oneline`, `git show <commit>:<path>` and `nl -ba <path>` reproduce commit, history and line references.

**Performance evidence:** [performance.json](../logistics-foundation/evidence/performance.json) records 30 requests for each of 6 API endpoints after 3 warm-ups and 3 warmed navigations for each of 3 UI screens. The API p95 values range from 3.7 to 15.2 ms; the first-visible-row/card proxy p95 values range from 157.4 to 185.5 ms. Both recorded proxy target checks are true. Reproduce the calculation with `jq '{environment, targetsMet, api: [.api[] | {name,count,p95Ms}], ui: [.ui[] | {name,count,p95Ms}]}' logistics-foundation/evidence/performance.json`; rerun the probe from `logistics-foundation/` against a seeded production server using `PERF_BASE_URL=http://127.0.0.1:3100 PERF_OUTPUT=/tmp/comp3500-performance.json CHROMIUM_PATH="$(command -v chromium)" node scripts/perf-probe.mjs`. Subsequent timings are separate measurements.

**CI:** The hardened evidence commit passed [run 42948472214](https://github.com/Et1enneee/comp3500-logistics/actions/runs/42948472214); the baseline-record commit `985f74c5395346f41881e6d7eea1eaae411ac8e0` passed [run 42948722240](https://github.com/Et1enneee/comp3500-logistics/actions/runs/42948722240). Reproduce with `gh run view 42948472214 --json headSha,status,conclusion,url` and the corresponding command for the baseline-record run. The report commit follows these commits and has its own CI result on GitHub.

### Glossary

- **Baseline:** a named commit used to identify the source or evidence under examination.
- **Functional requirement (FR):** a specified system behaviour identified in the requirement register.
- **Non-functional requirement (NFR):** a quality or process constraint with conditions and a verification method.
- **Risk register (RK):** a record of project risks, their impact, mitigation and status.
- **Increment:** a defined portion of development with trigger, scope, exit criterion and evidence.
- **Continuous integration (CI):** automated integration checks run when configured repository events occur.
- **Source manifest:** a list of file hashes used to check that the checked-out source matches recorded digests.
- **Regression testing:** re-running relevant tests after a change to detect broken existing behaviour.
- **Verification:** evaluation against specifications; **validation:** evaluation against actual user needs.
- **Multiplicity:** the permitted number of associated instances at each end of a data relationship.
- **Layered architecture:** organisation of responsibilities in layers that interact through interfaces.
- **p95:** the sample value at the nearest-rank 95th percentile as calculated by `scripts/perf-probe.mjs`.
- **Local loopback:** communication between a client and server on the same host through a loopback address.
