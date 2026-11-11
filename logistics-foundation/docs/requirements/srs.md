# Software Requirements Specification — Warehouse Logistics

## 1. Introduction

### Purpose and scope

This specification defines the behaviour and constraints of the warehouse logistics application for its users, implementers and assessors. It covers one warehouse, a local deployment and simulated delivery. Real GPS, barcode scanning, recipient telephone collection, payment and carrier integration are outside the system scope.

The «system» boundary contains the Next.js application and its local SQLite database; Customer, Staff, Driver and Admin interact with it as external actors. Primary stakeholders are the four user roles; operational stakeholders also need an operable deployment and consistent data.

## 2. Overall description

| Role | Responsibilities | Entry page |
|---|---|---|
| Customer | Create, cancel and track own eligible orders and read notifications | [`/`](../../app/page.tsx), [`/orders`](../../app/orders/page.tsx) |
| Staff | Confirm, pick, ship, assign a driver and maintain inventory | [`/staff`](../../app/staff/page.tsx), [`/inventory`](../../app/inventory/page.tsx) |
| Driver | View assigned tasks and simulate delivery progress | [`/driver`](../../app/driver/page.tsx) |
| Admin | View and export operational reports | [`/admin`](../../app/admin/page.tsx) |

All roles use [`/login`](../../app/login/page.tsx). Runtime constraints (source: scope decision): a single warehouse; local server and SQLite database; fictional delivery information; simulated rather than externally integrated carrier events. The technology stack is Next.js, TypeScript, Prisma and SQLite; Node 24 or newer is required by the package configuration. See the [scope record](../closure/scope-and-srs-addendum.md) and [package](../../package.json).

## 3. Functional requirements

Priorities for FR-01–07 follow the [historical register](../reference/legacy/traceability-v0.md); FR-08 is prioritised within the current scope. Verification links identify executable tests, not user acceptance.

### Customer

**FR-01 — Create orders.** The system shall allow an authenticated customer to create an order with product lines and a total, pre-checking available stock without deducting it until confirmation. Priority: Must. *Must: order creation is the entry point to the core workflow.* Source: scope decision. Verification: integration test; [creation tests](../../tests/foundation.integration.ts). Status: Implemented ([evidence](../../tests/foundation.integration.ts)).

**FR-03 — Number and track orders.** The system shall generate order and shipment identifiers and allow the order owner to view the order and tracking history. Priority: Must. *Must: identifiers and tracking support retrieval throughout the order workflow.* Source: scope decision. Verification: integration test; [logistics chain](../../tests/logistics-chain.integration.ts). Status: Implemented ([evidence](../../tests/logistics-chain.integration.ts)).

**FR-05 — In-app notifications.** The system shall record notifications for defined order events and allow the recipient to view and mark them read. Priority: Should. *Should: notifications make state changes visible alongside the tracking page.* Source: scope decision. Verification: integration test; [notification tests](../../tests/notifications.integration.ts). Status: Implemented ([evidence](../../tests/notifications.integration.ts)).

### Staff

**FR-02 — Change order state.** The system shall enforce the order lifecycle and eligible cancellation, reserving or releasing inventory atomically when applicable. Priority: Must. *Must: a broken transition or stock invariant can corrupt the order workflow (RK-02).* Source: QA findings. Verification: unit and integration tests; [order](../../tests/orders.integration.ts), [cancellation](../../tests/cancel.integration.ts), [state constants](../../lib/constants.test.ts). Status: Implemented ([evidence](../../tests/orders.integration.ts)).

**FR-04 — Manage inventory and alerts.** The system shall show stock and inventory history, allow authorised replenishment, and identify products with stock strictly below their configured threshold. Priority: Must. *Must: accurate inventory is needed for confirmation and replenishment.* Source: scope decision. Verification: integration test; [inventory tests](../../tests/inventory.integration.ts). Status: Implemented ([evidence](../../tests/inventory.integration.ts)).

### Driver

**FR-08 — Simulate delivery.** The system shall allow staff to assign a shipped order to a driver and allow that driver to see assigned tasks and simulate pickup and delivery. Priority: Must for the current scope. *Must: assignment and status updates complete the current role-separated workflow.* Source: scope decision. Verification: integration test; [driver tests](../../tests/driver.integration.ts). Status: Implemented ([evidence](../../tests/driver.integration.ts)).

### Admin and all roles

**FR-06 — View operational reports.** The system shall allow an administrator to view aggregate operational data and export the order report as CSV. Priority: Should. *Should: reports support operational review while the core transaction workflow remains usable independently.* Source: scope decision. Verification: integration test; [report tests](../../tests/reports.integration.ts). Status: Implemented ([evidence](../../tests/reports.integration.ts)).

**FR-07 — Enforce access control.** The system shall authenticate users and restrict functions and records by role and object ownership. Priority: Must. *Must: role and ownership checks support privacy and preserve the responsibilities of each actor.* Source: scope decision. Verification: security integration tests; [authentication](../../tests/auth.integration.ts), [privacy](../../tests/privacy.integration.ts), [addresses](../../tests/address.integration.ts). Status: Implemented ([evidence](../../tests/auth.integration.ts)).

## 4. Non-functional requirements

The criteria distinguish local integration-point checks from continuous operation and scripted action counts from human user validation.

**NFR-01 — Performance.** The system shall respond to core queries within 2 seconds and show the first list content within 3 seconds. Priority: Must. *Must: response targets support usable interactive operations.* Conditions: production build on local loopback with seeded fixture. Measure and target: HTTP response p95 ≤ 2000 ms; first-contentful-paint p95 ≤ 3000 ms. Verification: [performance probe](../../scripts/perf-probe.mjs) and [performance evidence](../../evidence/performance.json). Status: Measured — local API and FCP p95 targets met ([performance evidence](../../evidence/performance.json)).

**NFR-02 — Availability at integration points.** The system shall start a local production build and serve the designated browser acceptance suite at an integration point. Priority: Must. *Must: the integrated teaching application must start and serve its role workflows.* Source: scope decision. Conditions: seeded local database and the configured CI or local browser environment. Measure: production build, test and browser-acceptance outcomes; target: these stages succeed for the identified tested source. Verification: [integration observations](../../evidence/availability/integration-observations.json) and [dated local checks](../../evidence/test-logs/2026-11-11-archaeology/). Status: Verified at 40 integration points ([evidence](../../evidence/availability/integration-observations.json)). This revision replaces the earlier 08:00–24:00 daily availability target with a point-in-time criterion; [continuous sampling](../availability-measurement.md) is a separate enhancement.

**NFR-03 — Least privilege.** The system shall restrict access by role and ownership and minimise staff-visible delivery address data. Priority: Must. *Must: role and object boundaries reduce unauthorised access to personal data.* Conditions: authenticated role and object ownership, including cross-customer requests. Measure and target: specified authorised access succeeds and unauthorised accesses or disclosure are rejected. Verification: [auth tests](../../tests/auth.integration.ts), [privacy tests](../../tests/privacy.integration.ts), [address tests](../../tests/address.integration.ts). Status: Implemented for the tested scenarios ([privacy tests](../../tests/privacy.integration.ts)).

**NFR-04 — Scripted operation effort.** The system shall support each selected core operation in at most three scripted major actions. Priority: Should. *Should: bounded operation steps support clear role workflows.* Source: scope decision. Conditions: the specified authenticated role begins on the relevant screen with a prepared fixture; login, navigation and error recovery are outside the count. Measure: scripted fills, selections and clicks per listed successful operation; target: no more than three per operation. Verification: [automated walkthrough](../../evidence/user-validation/automated-walkthrough.md) and [browser log](../../evidence/test-logs/2026-11-11-final-repair/browser.log). Status: Verified for eleven selected operations ([evidence](../../evidence/user-validation/automated-walkthrough.md)). Human fitness-for-purpose validation uses the [separate protocol](../user-validation/moderator.md).

**NFR-05 — Process quality.** The project shall apply code checks, contracts and continuous integration to configured branches and pull requests. Priority: Must. *Must: repeatable checks help detect integration and setup problems (RK-04).* Conditions: configured repository events. Measure and target: successful checks for the identified commit. Verification: [workflow](../../../.github/workflows/ci.yml), [dated tests](../../evidence/test-logs/2026-11-11/). Status: Implemented; the run is commit-specific ([CI workflow](../../../.github/workflows/ci.yml)).

## 5. External interfaces

Role pages are listed in §2. The application exposes versioned HTTP routes for orders, status, inventory, notifications, reports, authentication and delivery. Request schemas, status codes and role rules are defined in the [HTTP contract](../contracts/api.md); the [route tree](../../app/api/v1/) is the implementation index.

## 6. Specification review

| Check | Conclusion and evidence |
|---|---|
| Validity | Requirements describe the four role workflows; independent user validation is covered by the protocol. |
| Consistency | Lifecycle, diagram and [transition constants](../../lib/constants.ts) use the same legal transitions. |
| Completeness | FR-01–08 and NFR-01–05 are defined for the stated boundary; cross-day and user measurements follow their protocols. |
| Realism | The application and SQLite run locally, with simulated delivery; [tests](../../tests/) exercise the implementation. |
| Verifiability | Each requirement identifies an executable test, measurement procedure or run record. |

## 7. Document control

Version 2.1; date 2026-11-11. NFR-02 now specifies point-in-time integration availability rather than daily continuous availability; NFR-04 specifies a defined set of automated operations rather than a general human-action guarantee. Consolidated from the risk register, historical register v0 and development evidence; provenance chain in [traceability](../traceability.md) and the [audit record](../audit-2026-11-10.md).

| Revision | Basis and change |
|---|---|
| 2.0 to 2.1, 2026-11-11 | For the local deployment model, NFR-02 changed from the daily availability window to integration-point checks; NFR-04 was bounded to selected scripted operations. Basis: [integration observation archaeology](../../evidence/availability/integration-observations.json), [automated operation walkthrough](../../evidence/user-validation/automated-walkthrough.md), and [revision commit](https://github.com/Et1enneee/comp3500-logistics/commit/2da83b5). |
