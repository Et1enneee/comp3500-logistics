# Order Status: Historical v0.3 Design Scope

> Historical snapshot: the status and authentication claims below do not describe the current implementation. For the current simulated driver increment, see `../driver-module.md`; for cancellation and API rules, see `api.md`.

The design model of seven states / seven transitions is authoritative in lib/constants.ts and the Prisma enum; the original 9 state-machine unit tests are kept. The state model allowing a transition does not mean the HTTP API has implemented it.

| Transition | Design Rule | Current Implementation |
| --- | --- | --- |
| CREATED → CONFIRMED | STAFF; sufficient stock; reservation and ledger atomically completed | Implemented and tested in v0.2 |
| CREATED → CANCELLED | Customer cancels; no stock restock | Not implemented (out of scope this round) |
| CONFIRMED → CANCELLED | Staff/customer cancels per the original rules; releases the reservation | Not implemented; future reason will be named ORDER_CANCEL_RELEASE |
| CONFIRMED → PICKING | Staff starts picking | Implemented and tested in v0.3 (PATCH /status) |
| PICKING → SHIPPED | Staff ships and generates the unique shipment; no double deduction of reserved stock | Implemented and tested in v0.3 (POST /shipments) |
| SHIPPED → IN_TRANSIT | Simulated carrier update | Implemented and tested in v0.3 (PATCH /status) |
| IN_TRANSIT → DELIVERED | Simulated delivery/sign-off | Implemented and tested in v0.3 (PATCH /status) |

The v0.3 PATCH accepts to=CONFIRMED/PICKING/IN_TRANSIT/DELIVERED; to=SHIPPED and unimplemented targets return 400 INVALID_ARGUMENT — this must not be confused with the "illegal-transition 409 after a generic status API is implemented". When the target status does not match the source status, it returns 409 INVALID_STATE_TRANSITION with business data unchanged.

Customer cancellation and staff confirmation are two different use cases; a future use-case diagram should express their permissions separately. Real authentication, ownership checks, and new endpoints still need design and acceptance. RETURNED is out of scope for this package.

Current use-case descriptions and the implemented/pending split are in ../closure/use-cases.md and ../closure/usecase.puml; cancellation is still not among the implemented APIs.
