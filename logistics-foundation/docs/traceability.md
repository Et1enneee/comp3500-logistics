# Requirements Traceability · v0.4.0

IDs follow the original requirements document; the table below reflects only the current implementation and verifiable evidence. Test counts and raw logs are in `evidence/` in the delivery package.

| ID | Original Requirement/Priority | Current Implementation | Primary Evidence | Status |
|---|---|---|---|---|
| FR-01 | Order creation, Must | `POST /api/v1/orders`, customerId from the session, stock pre-check without deduction, price snapshot | `tests/foundation.integration.ts`; browser 01–02 | Implemented |
| FR-02 | Status transitions and cancellation, Must | confirm/pick/ship/pickup/delivery + cancel (CREATED no restock / CONFIRMED restocks once); rejected after PICKING | `tests/orders.integration.ts`, `tests/logistics-chain.integration.ts`, `tests/cancel.integration.ts` | Implemented |
| FR-03 | Numbering and tracking, Must | unique ORD/LG numbering; customer self-service order center and timeline; cross-customer 404 | `tests/logistics-chain.integration.ts`; browser 03–04, 09 | Implemented |
| FR-04 | Inventory and low-stock alerts, Must | available-stock semantics; negative ledger on confirm, positive release on cancel, positive replenishment; strict `stock<threshold`; separate alert area and ledger page | `tests/inventory.integration.ts`, `tests/cancel.integration.ts`; browser 16–18 | Implemented |
| FR-05 | In-app notifications, Should | five business event types generated within transactions; (orderId,type) unique; unread count/mark-as-read | `tests/notifications.integration.ts`; browser 10 | Implemented |
| FR-06 | Operational reports, Should | ADMIN read-only aggregates, GMT+8 date range, CSV export | `tests/reports.integration.ts`; browser 11 | Implemented |
| FR-07 | Users/roles/auth, Must | scrypt passwords, Session + HttpOnly cookie, CSRF, rate limiting, 401/403/404 boundaries | `tests/auth.integration.ts`; `lib/auth.ts`, `lib/http.ts` | Implemented |
| NFR-01 | Core queries ≤2s, list first paint ≤3s, Must | production build, 30 API samples, 3 UI samples | `evidence/performance.json` | Meets target locally; not public-network/high-concurrency |
| NFR-02 | Available 08:00–24:00 daily, Must | no long-term run | — | Not verified (short tests are not a substitute) |
| NFR-03 | Least privilege, Must | role matrix + object-level 404; staff order responses omit customer identity and customer ID; customer actors in inventory logs are anonymized | `tests/auth.integration.ts`, `tests/orders.integration.ts`, `tests/privacy.integration.ts` | Implemented for the current simulated workflow |
| NFR-04 | Core operations ≤3 steps, Should | customer order placement, staff confirm/ship etc. fit within ≤3 major actions per screen; no formal timed walkthrough | browser script steps | Partial (not formally accepted) |
| NFR-05 | Code standards/contracts/CI, Must | typecheck/lint/unit/integration/build/browser all executable; root CI configuration complete | `evidence/test-logs/`, `.github/workflows/ci.yml` | All green locally; remote CI is judged by the actual run after upload |

Interfaces and error codes are in `contracts/api.md`; limitations are in `known-issues.md`.
