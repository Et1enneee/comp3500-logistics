# Frozen Baseline v0.3.1 · Data Terminology

The structure is authoritative in prisma/schema.prisma. No schema migration this round; it keeps the inverse relations fixed by Yin Peixu and the existing initial migration.

- Product.stock explicitly means **available stock** in this candidate implementation, not "physical on-hand including reserved". This is the frozen implementation's semantic convergence on the early contract's "book on-hand" wording; this file records the currently runnable behavior. Yin has source-reviewed and confirmed no double deduction; it is not presumed that all teammates' old files are synced, nor that Yang has signed off. Full requirements coverage is in ../closure/scope-and-srs-addendum.md.
- Creation: pre-checks available stock; does not decrease stock or write an InventoryLog. Duplicate SKUs are aggregated; unit-price snapshots and totals all use integer cents.
- Confirmation: CREATED → CONFIRMED; in the same transaction stock -= quantity, one delta=-quantity / reason=ORDER_CONFIRM / orderId-linked ledger entry per product.
- No reserved field is added, and no independent Reservation entity is claimed.
- Later shipping rules (wired in v0.3): PICKING → SHIPPED goes through POST /api/v1/shipments; the unique shipment number (LG-YYYYMMDD-XXXXXX) and initial TrackingEvent are generated in the same transaction; the already-reserved stock is not deducted again and no InventoryLog is written.
- Later cancellation rules: still out of scope this round; in the future a CONFIRMED cancellation releases the reserved quantity once, writes the matching positive ledger entry (reason will be named ORDER_CANCEL_RELEASE), and completes the status change and restock atomically. No cancellation API is currently implemented.
- Order.orderNumber is ORD-YYYYMMDD-XXXX; Order.id is the internal primary key. Confirmation uses the latter.
- GET returns customer id/name/email and never passwordHash; there is no object-level query authorization yet, so no real customer data may be used.
- Shipment and TrackingEvent have running features wired in v0.3 (shipping and tracking); Notification is still not implemented.
- TrackingEvent is append-only: shipping writes "Warehouse", simulated pickup writes "Pickup station", simulated delivery writes "Delivery address"; the tracking API returns events in chronological order.

Demo data note: SKU008's current seed is stock 50 / threshold 10. The 6 / 5 in the historical acceptance draft is a test fixture and does not mean the seed changed. This package does not fake alert-test passes by changing the seed.
