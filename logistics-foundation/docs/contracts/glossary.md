# Domain Glossary · Current Implementation Terminology

> Derived from the old glossary; the inventory definition has been converged to the frozen implementation. The role table describes the full requirements goal, which does not mean all features are currently implemented; see actual permissions in ../closure/scope-and-srs-addendum.md.

## Entity Terms

| Term | Definition |
| --- | --- |
| Order | A purchase record initiated by a customer, with a unique order number |
| Order Number | Internal serial number (e.g. ORD-20261027-0001), distinct from the tracking number |
| SKU / Product | The smallest stockable, sellable unit of goods |
| Inventory | In the current implementation, available stock Product.stock; reserved at confirmation, not deducted again at shipping; no reserved field |
| Inventory Log | The account of every stock change (delta, reason, related order) |
| Shipment | One shipping action, carrying a unique tracking number |
| Tracking Number | The number customers use for tracking, unique for life |
| Carrier | The party performing transportation (simulated data for the demo) |
| Tracking Event | A point-in-time record while the shipment is in transit (time, location, description) |
| Alert | A system notice that stock is below the threshold |
| Notification | A status-change push (in-app simulation for the demo) |
| Role | The three user kinds: CUSTOMER / STAFF / ADMIN |

## Status Values (same source as the state machine, defined in one place)

| Value | Label | Value | Label |
| --- | --- | --- | --- |
| CREATED | Created | SHIPPED | Shipped |
| CONFIRMED | Confirmed | IN_TRANSIT | In Transit |
| PICKING | Picking | DELIVERED | Delivered |
| CANCELLED | Cancelled |  |  |

## Full Design Goals (not a statement of current completion)

| Role | What they can do (Must scope) |
| --- | --- |
| Customer | Register and log in, create orders, query orders and shipment tracking, receive notifications |
| Staff | Confirm orders, pick and ship, generate shipments, receive stock, view inventory alerts |
| Admin | View dashboards and reports (Should, Sprint 2); does not directly modify order data |
