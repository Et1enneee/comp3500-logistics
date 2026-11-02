# v0.3.1 Order and Logistics API (historical record)

> This section documents the v0.3.1 contract as originally shipped, and is retained for historical context. It is superseded where it differs by the **"v0.4.0 API Additions"** section below, which documents the current capabilities (real sessions, order center, cancellation, inventory, notifications, and reports).

This v0.3.1 contract covers order placement, lookup by order number, staff confirm/pick, shipping, tracking, and simulated pickup/delivery via the demo-email header, and does not support cancellation. It keeps the original order-confirmation semantics. Scope and verification entries are in ../closure/README.md.

## GET /api/v1/orders?orderNumber=ORD-…

Exact lookup by the page's ORD order number; no listing. A blank parameter is treated as empty.
200 returns `{ "order": ... }`. Original Order/OrderItem field names are unchanged; product.sku / product.name are added in items.
The customer keeps only id/email/name; unrelated fields such as password hashes are removed. All amounts are integer cents.
A sample response is in `get-order.example.json`. That file preserves a real demo response from a local HTTP query on 2026-10-26: order ORD-20261026-0001, status CONFIRMED, product SKU001 × 2, total 300 cents. It is a snapshot of that moment's response; the frontend must not hardcode its IDs, order number, amounts, or status. The {id} in the confirmation path must use the order.id returned by this query.

## PATCH /api/v1/orders/{id}/status

{id} is interpreted only as the internal database order.id; it is never guessed or fallen back to the ORD order number.
Headers: Content-Type: application/json; X-Demo-User-Email: a demo email from the User table (required).
Body: `{ "to": "CONFIRMED" | "PICKING" | "IN_TRANSIT" | "DELIVERED" }` (since v0.3).
200: `{ "order": { "id": "…", "orderNumber": "ORD-…", "status": "<target status>", "totalCents": 300 } }`

| to | Allowed current status | Side effects (same transaction) |
| --- | --- | --- |
| CONFIRMED | CREATED | available stock -= quantity; one delta=-quantity / reason=ORDER_CONFIRM ledger entry per product |
| PICKING | CONFIRMED | status change only; no stock deduction, no inventory ledger entry |
| IN_TRANSIT | SHIPPED | shipment status→IN_TRANSIT; adds a pickup TrackingEvent (pickup station) |
| DELIVERED | IN_TRANSIT | shipment status→DELIVERED, writes deliveredAt; adds a delivery TrackingEvent (delivery address) |

- Shipping (→SHIPPED) is not accepted via PATCH: returns 400 INVALID_ARGUMENT with a message pointing to POST /api/v1/shipments.
- Other targets (e.g. CANCELLED) are not implemented in v0.3.1: 400 INVALID_ARGUMENT. Cancellation was added in v0.4.0; see the additions below.
- Repeated submission to the same target: 409 INVALID_STATE_TRANSITION with no side effects.
- IN_TRANSIT/DELIVERED when the order has no shipment: 409 SHIPMENT_NOT_FOUND and the order status rolls back.
- On success the frontend GETs the same ORD order number again to refresh details; since v0.3 the frontend also reads tracking.
- Error codes: 400 INVALID_ARGUMENT; 401 UNAUTHENTICATED; 403 FORBIDDEN (not STAFF); 404 ORDER_NOT_FOUND; 409 INSUFFICIENT_STOCK / INVALID_STATE_TRANSITION / SHIPMENT_NOT_FOUND; 500/503.

## POST /api/v1/shipments

Shipping (PICKING → SHIPPED). STAFF demo accounts only.
Headers: Content-Type: application/json; X-Demo-User-Email (required).
Body: `{ "orderNumber": "ORD-YYYYMMDD-XXXX", "carrier": "SF Express" }` (carrier 1–40 characters).
201: `{ "shipment": { "id": "…", "trackingNumber": "LG-YYYYMMDD-XXXXXX", "carrier": "…", "status": "SHIPPED", "shippedAt": "…" }, "order": { "id": "…", "orderNumber": "…", "status": "SHIPPED", "totalCents": 300 } }`
Completed within one transaction: order PICKING→SHIPPED (conditional update), generates the unique shipment number for the day, writes one initial TrackingEvent (warehouse).
Stock: no deduction, no InventoryLog (stock was already reserved at confirmation).
Errors: 400 INVALID_ARGUMENT (invalid JSON / missing order number / missing carrier / non-JSON Content-Type); 401 UNAUTHENTICATED; 403 FORBIDDEN (not STAFF); 404 ORDER_NOT_FOUND; 409 SHIPMENT_EXISTS (shipment already exists / already shipped; repeated requests do not create a second one); 409 INVALID_STATE_TRANSITION (not PICKING); 500/503.
Sequential or concurrent duplicate shipping: only one shipment is produced; failures leave no shipment or tracking events behind.

## GET /api/v1/orders/{id}/tracking

{id} is the internal order.id. Read-only; the same demo posture as GET /orders — no X-Demo-User-Email required and no object-level ownership check (known limitation).
200: `{ "trackingNumber": "LG-…", "carrier": "…", "status": "SHIPPED|IN_TRANSIT|DELIVERED", "events": [ { "at": "…", "location": "…", "description": "…" } ] }`, events in chronological order.
Errors: 400 INVALID_ARGUMENT (empty id); 404 ORDER_NOT_FOUND; 404 SHIPMENT_NOT_FOUND (not yet shipped); 500.
A wrong id returns only 404 and never any field of another order.

## Errors

All API errors in this round use `{ "error": { "code": "…", "message": "human-readable explanation" } }`.

* 400 INVALID\_ARGUMENT: empty order number, non-JSON Content-Type, missing/invalid JSON, missing or unsupported to (including to=SHIPPED, which must go through POST /shipments).
* 401 UNAUTHENTICATED: demo email missing or not found in the User table.
* 403 FORBIDDEN: role is not STAFF, including CUSTOMER and ADMIN (shipping likewise requires STAFF).
* 404 ORDER\_NOT\_FOUND: order does not exist (when confirming with a valid STAFF).
* 404 SHIPMENT\_NOT\_FOUND: the order has no shipment yet when tracking or updating logistics status.
* 409 INSUFFICIENT\_STOCK: any product in the CREATED order has insufficient available stock.
* 409 INVALID\_STATE\_TRANSITION: illegal transition (already confirmed/picked/shipped etc.), business data unchanged.
* 409 SHIPMENT\_EXISTS: duplicate shipping; a shipment already exists and a second one will not be created.
* Additional fallbacks: 500 INTERNAL\_ERROR; recognizable database busy/conflict retries exhausted return 503 TEMPORARILY\_UNAVAILABLE. The frontend should be able to display the message of an unknown code.
Validation order: parameters/JSON → demo identity → in-transaction status and stock. When multiple errors coexist, they are returned in this order.
Empty items or illegal legacy quantities return 400 with no stock changes. Confirmation still defensively checks legacy order quantities; this candidate POST has verified positive integer quantities.

## Identity Limitations (v0.3.1 only)

In v0.3.1 the email header is only a demo identifier and can be impersonated; it is not login authentication and constitutes no security acceptance. It must be used only in an isolated demo environment. This limitation is superseded by the real server-side session authentication added in v0.4.0 (see below); the demo-email header no longer has any effect.

## Frontend Call Example (illustrative; demo email taken from the selection box)

```ts
const r = await fetch(`/api/v1/orders?orderNumber=${encodeURIComponent(orderNumber)}`);
const data = await r.json();
if (!r.ok) throw new Error(data.error.message);
const id = data.order.id;
const confirmation = await fetch(`/api/v1/orders/${encodeURIComponent(id)}/status`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json", "X-Demo-User-Email": selectedDemoEmail },
  body: JSON.stringify({ to: "CONFIRMED" }),
});
const result = await confirmation.json();
if (!confirmation.ok) throw new Error(result.error.message);
// On success, GET the orderNumber again to refresh page status and details.
```


## POST /api/v1/orders (new validations in the foundation candidate)

Request JSON: `{"email":"customer@demo.com","items":[{"sku":"SKU001","quantity":2}]}`.

- At least 1 and at most 100 items; quantities are positive integers; duplicate SKUs are aggregated before the stock pre-check.
- The customer must exist with the CUSTOMER role; the demo email is still not real authentication.
- 201 returns `{order}`; product lines record a unit-price snapshot at placement, and the server computes the integer-cent total.
- Creation does not change Product.stock or produce an InventoryLog; the pre-check does not promise to lock stock.
- 400 INVALID_ARGUMENT: invalid JSON, empty order, illegal quantity, or amount/quantity over the limit.
- 400 CUSTOMER_NOT_FOUND / SKU_NOT_FOUND_<sku> / INSUFFICIENT_STOCK_<sku>: the corresponding creation error categories are kept, with readable messages.
- 403 FORBIDDEN: not a CUSTOMER demo account.
- 500 INTERNAL_ERROR / 503 TEMPORARILY_UNAVAILABLE: exception or retries exhausted.
- Numbering uses ORD-YYYYMMDD-XXXX by UTC calendar day; page times display GMT+8, so numbers may cross dates at night — not a wrong order. At most 9999 numbers per day; unique conflicts/transient contention retry at most three times. No client-side create idempotency key is implemented; do not blindly resubmit when the result is unknown.

## Pages and Data

`/` reads the product catalog live from the database on the server; prices and stock are no longer hardcoded in the browser. `/staff` confirms with order.id after lookup and queries again on success; since v0.3 the same page can continue picking, shipping, and viewing shipment tracking. Pages do not show the raw inventory ledger table; inventory/ledger checks are done by tests or database review. GET /orders still excludes shipment; tracking goes through the separate endpoint GET /orders/{id}/tracking.

---

# v0.4.0 API Additions (real sessions / order center / inventory / notifications / reports)

> Current as of v0.4.2. This section documents the implemented, test-covered API surface and supersedes the v0.3.1 contract above wherever they differ.

## Authentication and Sessions

All endpoints rely on the server-side session; `X-Demo-User-Email` no longer has any effect.

| Method | Path | Role | Notes |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/login` | public | `{email,password}`; success 200 `{user,csrfToken,expiresAt}` with Set-Cookie (HttpOnly/SameSite=Lax/8h); failure 401 with identical wording; same-origin check; rate limit 429 `RATE_LIMITED` |
| POST | `/api/v1/auth/logout` | logged in | requires `X-CSRF-Token`; deletes the server-side session and clears the cookie; without the token 403 `CSRF_INVALID` |
| GET | `/api/v1/auth/me` | logged in | returns `{user,csrfToken,expiresAt}`; 401 when not logged in |

Write requests (POST/PATCH/DELETE) uniformly require `X-CSRF-Token` equal to the session token; when `Origin` is present it must also be same-origin with `Host`. Errors remain `{error:{code,message}}`.

## Orders

| Method | Path | Role | Notes |
| --- | --- | --- | --- |
| POST | `/api/v1/orders` | CUSTOMER | identity from the session; if the body contains `email/customerId` it must match the session, otherwise 403. 201 `{order}` |
| GET | `/api/v1/orders?orderNumber=ORD-…` | CUSTOMER/STAFF | exact lookup by ORD; a customer reading another's order gets 404 |
| GET | `/api/v1/orders?page=&pageSize=&status=` | CUSTOMER/STAFF | paginated list `{orders,page,pageSize,total,totalPages}`; customers see only their own; ADMIN 403 |
| GET | `/api/v1/orders/{internal id}` | CUSTOMER/STAFF | details (with shipment summary); cross-customer access 404 |
| PATCH | `/api/v1/orders/{internal id}/status` | STAFF; CUSTOMER only cancels own | `to` ∈ CONFIRMED/PICKING/IN_TRANSIT/DELIVERED/CANCELLED; `to=SHIPPED` still 400, must go through the shipping endpoint |
| GET | `/api/v1/orders/{internal id}/tracking` | CUSTOMER/STAFF | shipment and events (chronological); 404 `SHIPMENT_NOT_FOUND` before shipping; cross-customer access 404 |

STAFF order list and detail responses omit the customer identity and customer ID; the interface retains operational order fields. Customer-owned order responses are unchanged. Order numbers are lookup identifiers, not authentication credentials.

Cancellation semantics: `CREATED→CANCELLED` leaves stock and ledger untouched; `CONFIRMED→CANCELLED` restores stock in the same transaction with one positive `ORDER_CANCEL_RELEASE` ledger entry per SKU; `PICKING` and later 409; repeated/concurrent attempts succeed at most once; staff can cancel only CONFIRMED; ADMIN 403.

## Shipping

`POST /api/v1/shipments` (STAFF) `{orderNumber,carrier}`: only `PICKING` can ship; the same transaction writes the status, the unique `LG-` shipment, the initial tracking event, and a notification; duplicates 409 `SHIPMENT_EXISTS` or `INVALID_STATE_TRANSITION`; stock is not deducted again.

## Inventory

| Method | Path | Role | Notes |
| --- | --- | --- | --- |
| GET | `/api/v1/inventory?page=&pageSize=&sku=&lowStock=1` | STAFF/ADMIN | paginated; `isLowStock = stock < lowStockThreshold`; includes `lowStockCount` |
| GET | `/api/v1/inventory/low-stock` | STAFF/ADMIN | `{products,count}` |
| POST | `/api/v1/inventory/{productId}/replenish` | STAFF | `{quantity}` positive integer (≤1,000,000), increments only; writes `STOCK_REPLENISH` + operator; 201 `{product,log}` |
| GET | `/api/v1/inventory/logs?sku=&orderNumber=&page=&pageSize=` | STAFF/ADMIN | delta/reason/time/related order/operator; customer actors are displayed without their identity; no delete endpoint |

## Notifications

| Method | Path | Role | Notes |
| --- | --- | --- | --- |
| GET | `/api/v1/notifications?page=&pageSize=&unread=1` | CUSTOMER | own only; returns `unreadCount` |
| GET | `/api/v1/notifications/unread-count` | CUSTOMER | `{unreadCount}` |
| POST | `/api/v1/notifications/{id}/read` | CUSTOMER | own only; others'/nonexistent 404 `NOTIFICATION_NOT_FOUND` |

Notifications are generated within the same transaction as confirm/cancel/ship/pickup/delivery; `(orderId,type)` is unique, and repeated requests do not resend.

## Reports

| Method | Path | Role | Notes |
| --- | --- | --- | --- |
| GET | `/api/v1/reports/overview?from=YYYY-MM-DD&to=YYYY-MM-DD` | ADMIN | defaults to the last 7 GMT+8 calendar days; `{range,orders:{count,byStatus,nonCancelledAmountCents,deliveredAmountCents},inventory:{lowStockSkuCount,note},daily[]}` |
| GET | `/api/v1/reports/export.csv?from=&to=` | ADMIN | UTF-8 BOM; columns `orderNumber,createdAtGmt8,timezone,status,statusLabel,totalCents,totalYuan`; formula-injection prefix `'`; no personal data |

Customers and staff accessing reports get 403; not logged in 401. All amounts are "order amounts" (no payments, never called revenue).
