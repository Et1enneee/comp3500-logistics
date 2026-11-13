# Current Acceptance Scenarios

This table reflects the current implementation (v0.4.2); old-branch and old-main records remain in docs/process and the retained legacy traceability file, and in Git history and are not claimed as this round's execution.

| Linked | Given | When | Then | Verification Entry |
|---|---|---|---|---|
| FR-01 | Customer demo account, SKUs, and sufficient stock | Submit a positive integer quantity | 201/CREATED, ORD, server-side total/snapshot; stock and logs unchanged | foundation.integration |
| FR-01/04 | SKU007 stock 4 | Create 10 units | 400 readable insufficient-stock error; no order created | foundation+browser |
| FR-02/04 | CREATED with sufficient stock | Staff confirms | Atomically deducts available stock, one ORDER_CONFIRM per SKU, CONFIRMED | orders.integration |
| FR-02 | CONFIRMED | Confirm again | 409; stock/ledger unchanged | orders+browser |
| FR-02/04 | A creates when stock is 10; B later confirms 7, leaving 3 | Confirm A's 10 units | 409; A stays CREATED, stock 3, no confirmation log for A | foundation.integration |
| FR-02 | CREATED | Request DELIVERED | 409 illegal transition; data unchanged | orders.integration |
| FR-02 | CONFIRMED | Pick | PICKING; stock/ledger unchanged | logistics-chain.integration |
| FR-03/04 | PICKING | Ship | 201, unique LG, SHIPPED and initial event in the same transaction; no further stock deduction | logistics-chain+browser |
| FR-03 | Already shipped | Sequential/concurrent duplicate ship | 409; only one shipment | logistics-chain.integration |
| FR-02/03 | SHIPPED with a shipment | Staff simulates pickup then delivery | IN_TRANSIT→DELIVERED, three events in order, stock unchanged | logistics-chain+browser |
| FR-07 | Logged-in CUSTOMER or ADMIN | Change fulfillment status / ship | 403, no business change; missing session 401 | logistics-chain.integration |
| FR-03 | Status change succeeds but tracking read fails with 500/network error | Page refresh | Order/success result preserved, tracking failure reported separately, no prompt to resubmit | browser-smoke |
| FR-02 | CREATED, own order | Customer cancels | CANCELLED; stock and ledger untouched | cancel.integration |
| FR-02/04 | CONFIRMED with reserved stock | Cancel (customer own order / staff) | Stock restored exactly once; one ORDER_CANCEL_RELEASE per SKU; repeated/concurrent cancel succeeds at most once; multi-product failure rolls back all | cancel.integration + browser 14–15 |
| FR-02 | PICKING or later | Cancel | 409 with no stock change; cross-customer cancel 404; staff can cancel only CONFIRMED; ADMIN cannot cancel | cancel.integration |
| FR-04 | SKU below threshold (4 < 5) | View inventory / replenish 1 | Alert listed while stock < threshold, gone at exactly 5; replenish increments only, writes STOCK_REPLENISH + operator; no delete/overwrite endpoint; invalid quantities and missing CSRF rejected without changes | inventory.integration + browser 16–18 |
| FR-04 | CUSTOMER / ADMIN session | Read inventory / replenish | CUSTOMER 403 for both; ADMIN read-only list, replenish 403 | inventory.integration |
| FR-05 | Customer with confirm/cancel/ship/pickup/deliver events | Open notifications / mark read | Exactly one notification per event (orderId,type unique, duplicates/concurrency do not multiply); own-only list with unread count; others' mark-read 404; STAFF/ADMIN 403 | notifications.integration + browser 10 |
| FR-06 | ADMIN session, orders across GMT+8 days | Open reports / export CSV | Aggregates match the DB (cancelled counted in status, excluded from amounts); snapshot amounts and current inventory snapshot; range validation 400; CUSTOMER/STAFF 403; CSV fixed columns, formula injection neutralised, no personal data | reports.integration + browser 11 |
| FR-07 | Valid seeded account + correct password | Login / logout | scrypt hash with per-user salt; HttpOnly SameSite session cookie, no secrets in response; wrong password/unknown user same 401 wording; 5 failures in 10 minutes → 429 (rotating forwarded headers cannot evade); logout deletes the session, reused cookie 401 | auth.integration |

Cancellation, standalone alerts/replenishment, notifications, reports, and real authentication are implemented in v0.4.2; the rows above list their current scenarios and verification entries. Out-of-scope items (public registration, password recovery, OAuth/MFA, real payments/carriers, etc.) remain recorded as not implemented in `known-issues.md` (item 16) and are not claimed as done.
