# Current Acceptance Scenarios

This table reflects the current implementation; old-branch and old-main records remain in reference/legacy and Git history and are not claimed as this round's execution.

| Linked | Given | When | Then | Verification Entry |
|---|---|---|---|---|
| FR-01 | Customer demo account, SKUs, and sufficient stock | Submit a positive integer quantity | 201/CREATED, ORD, server-side total/snapshot; stock and logs unchanged | foundation.integration |
| FR-01/04 | SKU007 stock 4 | Create 10 units | 400 with readable insufficient-stock error; no order created | foundation+browser |
| FR-02/04 | CREATED with sufficient stock | Staff confirms | Atomically deducts available stock, one ORDER_CONFIRM per SKU, CONFIRMED | orders.integration |
| FR-02 | CONFIRMED | Confirm again | 409; stock/ledger unchanged | orders+browser |
| FR-02/04 | A creates when stock is 10; B later confirms 7, leaving 3 | Confirm A's 10 units | 409; A stays CREATED, stock 3, no confirmation log for A | foundation.integration |
| FR-02 | CREATED | Request DELIVERED | 409 illegal transition; data unchanged | orders.integration |
| FR-02 | CONFIRMED | Pick | PICKING; stock/ledger unchanged | logistics-chain.integration |
| FR-03/04 | PICKING | Ship | 201, unique LG, SHIPPED and initial event in the same transaction; no further stock deduction | logistics-chain+browser |
| FR-03 | Already shipped | Sequential/concurrent duplicate ship | 409; only one shipment | logistics-chain.integration |
| FR-02/03 | SHIPPED with a shipment | Staff simulates pickup then delivery | IN_TRANSIT→DELIVERED, three events in order, stock unchanged | logistics-chain+browser |
| FR-07 | CUSTOMER or ADMIN demo identity | Change fulfillment status / ship | 403, no business change; missing identity 401 | logistics-chain.integration |
| FR-03 | Status change succeeds but tracking read fails with 500/network error | Page refresh | Order/success result preserved, tracking failure reported separately, no prompt to resubmit | browser-smoke |

Cancellation, standalone alerts/replenishment, notifications, reports, and real authentication are not yet implemented; the corresponding scenarios cannot be executed, and they must not be removed from the full requirements.
