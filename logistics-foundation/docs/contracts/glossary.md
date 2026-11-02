# Domain Glossary · Current Implementation Terminology

> Derived from the old glossary; the inventory definition has been converged to the frozen implementation. The role table describes the full requirements goal, which does not mean all features are currently implemented; see actual permissions in ../closure/scope-and-srs-addendum.md.

## Entity Terms

| Term (Chinese) | English | Definition |
| --- | --- | --- |
| 订单 | Order | A purchase record initiated by a customer, with a unique order number |
| 订单号 | Order Number | Internal serial number (e.g. ORD-20261027-0001), distinct from the tracking number |
| 单品 | SKU / Product | The smallest stockable, sellable unit of goods |
| 库存 | Inventory | In the current implementation, available stock Product.stock; reserved at confirmation, not deducted again at shipping; no reserved field |
| 库存流水 | Inventory Log | The account of every stock change (delta, reason, related order) |
| 运输单 | Shipment | One shipping action, carrying a unique tracking number |
| 运单号 | Tracking Number | The number customers use for tracking, unique for life |
| 承运商 | Carrier | The party performing transportation (simulated data for the demo) |
| 跟踪事件 | Tracking Event | A point-in-time record while the shipment is in transit (time, location, description) |
| 预警 | Alert | A system notice that stock is below the threshold |
| 通知 | Notification | A status-change push (in-app simulation for the demo) |
| 角色 | Role | The three user kinds: CUSTOMER / STAFF / ADMIN |

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
