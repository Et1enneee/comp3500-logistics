# Driver Module · Simulated Delivery Increment

## Context and scope

The initial group discussion identified a driver role. This increment adds a deliberately small delivery workflow to the existing local teaching demo. It does not claim that all originally discussed driver functions are complete. Customers enter a single-line delivery address when placing new orders; the assigned driver can see it. No GPS, real scanner, recipient phone, real carrier connection, proof of delivery or payment is implemented. The location label “Delivery address” in tracking events is a simulated milestone, not the actual address.

## Requirements and acceptance criteria

| ID | Requirement | Verification |
| --- | --- | --- |
| DR-01 | A driver signs in using the existing session and sees only shipments assigned to that account. | `tests/driver.integration.ts`: two drivers, separate task lists; browser driver workflow. |
| DR-02 | Staff can assign/reassign an existing SHIPPED order to a DRIVER before pickup; invalid role, user, CSRF or state is rejected. | `tests/driver.integration.ts`; browser staff assignment. |
| DR-03 | The assigned driver may simulate SHIPPED → IN_TRANSIT → DELIVERED in order. Other drivers cannot update the order. | `tests/driver.integration.ts`; browser pickup and delivery. |
| DR-04 | A successful transition updates order, shipment, tracking event and customer notification together; it does not change stock. Repeated and concurrent pickup cannot succeed twice. | `tests/driver.integration.ts`; existing order/logistics regression tests. |
| DR-05 | Only the order owner and assigned driver receive the delivery address; staff responses omit it. Customer name and contact details are not included in driver task responses. | `tests/address.integration.ts`, `tests/driver.integration.ts`, `tests/privacy.integration.ts`. |
| DR-06 | Migrations preserve existing shipments and orders without inventing assignments or addresses. | `npm run verify:migration`; fresh disposable database migration and seed. |
| DR-07 | New orders require a valid 1–200 character delivery address; the server validates it independently. | `tests/address.integration.ts`; browser order workflow. |

## Context and state model

Customer enters a delivery address and places order → Staff confirms and picks → Staff ships and assigns a driver → assigned Driver simulates pickup → assigned Driver simulates delivery → Customer sees tracking and notifications.

`CREATED → CONFIRMED → PICKING → SHIPPED → IN_TRANSIT → DELIVERED` (existing cancellation rules remain unchanged). Assignment is optional on a shipment and can be changed only while the order is SHIPPED. Historical shipments remain unassigned and historical orders have no address after migration; the driver page explicitly marks the missing address. The demo permits simulated processing of old orders without an address for backward compatibility, so these cannot represent real delivery. Staff retains the existing manual simulated pickup/delivery capability for compatibility; driver assignment is not a condition for that staff fallback. A DRIVER cannot confirm, pick, ship or cancel, and non-assigned order status updates return 404.

## Architecture and trade-offs

- Browser pages call role-checked server routes; sessions and CSRF remain the authority, not an entered order number.
- `Shipment.driverId` relates an optional shipment assignment to a user. The assignment write checks SHIPPED status atomically. The driver's conditional status update checks both state and assignment inside the existing transaction.
- Driver task queries return only assigned operational fields and the address, but no customer name or contact details. An address is personal data and remains linkable to the order; it is not anonymous. Staff order responses omit it. The local SQLite database stores it unencrypted, so use fictional demo addresses only.
- The module uses existing SQLite/Next.js infrastructure and does not add external services. The task list has no pagination and is intended for the demo data volume, not a large production fleet.
- Existing Staff transit/delivery fallback is deliberately retained; it makes the change backward compatible but does not enforce a driver-only delivery handoff.

## Process note

The driver role existed in the early discussion but was absent from the earlier implementation. This increment responds to that identified gap; it should not be presented as if the omission was a documented decision made earlier. Any priority or customer acceptance still needs confirmation from the actual project records.
