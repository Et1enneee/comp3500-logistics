# Automated operation walkthrough

Generated from the browser script and its dated execution log. Reproduce from the repository root with `node logistics-foundation/scripts/generate-automated-walkthrough.mjs`. One action is one scripted fill, selection or click on a relevant control. Each operation starts on the target screen with an authenticated role and a prepared fixture; login, navigation, waits, assertions, errors, and setup are outside the per-operation count. The checks include error and security cases, not 26 user journeys. The listed successful operations are a selected subset; automated actions do not measure human completion, errors, assistance or time.

| Role | Operation (browser check) | Actions | ≤3? |
|---|---|---:|---|
| Customer | Create an order ([cancel chain: confirm SKU007 order then cancel restores stock exactly once](../../scripts/browser-smoke.mjs#L439)) | 3 | Yes |
| Customer | Open order details ([customer order detail shows empty-shipment state (no stack trace)](../../scripts/browser-smoke.mjs#L217)) | 1 | Yes |
| Staff | Confirm order ([cancel chain: confirm SKU007 order then cancel restores stock exactly once](../../scripts/browser-smoke.mjs#L439)) | 2 | Yes |
| Staff | Start picking ([staff pick → ship generates unique LG waybill, stock not touched again](../../scripts/browser-smoke.mjs#L285)) | 1 | Yes |
| Staff | Ship order ([staff pick → ship generates unique LG waybill, stock not touched again](../../scripts/browser-smoke.mjs#L285)) | 2 | Yes |
| Staff | Assign driver ([staff assigns a shipped order and driver completes simulated delivery](../../scripts/browser-smoke.mjs#L164)) | 2 | Yes |
| Driver | Simulate pickup ([staff assigns a shipped order and driver completes simulated delivery](../../scripts/browser-smoke.mjs#L164)) | 1 | Yes |
| Driver | Simulate delivery ([staff assigns a shipped order and driver completes simulated delivery](../../scripts/browser-smoke.mjs#L164)) | 1 | Yes |
| Admin | Apply report date filter ([admin dashboard matches database aggregates and exports CSV](../../scripts/browser-smoke.mjs#L345)) | 3 | Yes |
| Admin | Export current report ([admin dashboard matches database aggregates and exports CSV](../../scripts/browser-smoke.mjs#L345)) | 1 | Yes |
| Admin | Export selected dates without applying filter ([admin exports selected dates without applying the filter](../../scripts/browser-smoke.mjs#L385)) | 3 | Yes |

The full customer creation check also tests an invalid submission before correction; the table instead selects the separate successful order-creation segment in the cancellation check. The staff confirmation regression deliberately exercises a Back action; the table uses the separate successful confirmation segment. The earlier filter-then-export sequence comprises four interactions. The direct export of selected dates takes three interactions: fill both dates and export, without applying the filter. From a screen with the desired dates already entered, export is one click. The direct API export assertion is additional to the actual browser download click.

[Browser execution log](../test-logs/2026-11-11-final-repair/browser.log) records the check results. [Human validation protocol](../../docs/user-validation/moderator.md) provides a separate method for assessing fitness for purpose.

## Complete browser-check map

These check IDs are the source-order indices in the test suite. Cross-cutting and recovery checks are shown as such; their presence does not imply an independently timed human journey.

| ID | Check | Role or actor | Coverage |
|---:|---|---|---|
| 1 | [closeout: invalid page parameters are recoverable across all list pages](../../scripts/browser-smoke.mjs#L62) | Customer / Staff / Admin | list validation |
| 2 | [closeout: malformed Cookie is expired for HTTP APIs and page navigation](../../scripts/browser-smoke.mjs#L92) | Unauthenticated / Customer | authentication |
| 3 | [review regressions: invalid dates and logout failures recover](../../scripts/browser-smoke.mjs#L109) | Admin / Customer | report / sign-out recovery |
| 4 | [customer A login lands on catalog with DB stock and role chip](../../scripts/browser-smoke.mjs#L155) | Customer | sign-in |
| 5 | [staff assigns a shipped order and driver completes simulated delivery](../../scripts/browser-smoke.mjs#L164) | Staff / Driver | assignment / delivery |
| 6 | [customer A creates an order: CREATED, stock unchanged, no ledger row](../../scripts/browser-smoke.mjs#L194) | Customer | order creation and error handling |
| 7 | [customer order detail shows empty-shipment state (no stack trace)](../../scripts/browser-smoke.mjs#L217) | Customer | order detail |
| 8 | [customer B cannot read A's order by direct URL or by ORD](../../scripts/browser-smoke.mjs#L227) | Customer | ownership security |
| 9 | [staff queue lists >50 orders with status filter and pagination](../../scripts/browser-smoke.mjs#L240) | Staff | order queue |
| 10 | [staff confirm reserves stock once and shows server-read state](../../scripts/browser-smoke.mjs#L265) | Staff | confirmation regression |
| 11 | [staff pick → ship generates unique LG waybill, stock not touched again](../../scripts/browser-smoke.mjs#L285) | Staff | picking / shipping |
| 12 | [tracking read failure after a successful transit does not report a false failure](../../scripts/browser-smoke.mjs#L299) | Staff | delivery recovery |
| 13 | [staff delivers; customer A sees delivered status + 3 ordered events](../../scripts/browser-smoke.mjs#L313) | Staff / Customer | delivery / tracking |
| 14 | [customer notification center shows unread count and marks one read](../../scripts/browser-smoke.mjs#L330) | Customer | notifications |
| 15 | [admin dashboard matches database aggregates and exports CSV](../../scripts/browser-smoke.mjs#L345) | Admin | report filter / export |
| 16 | [admin exports selected dates without applying the filter](../../scripts/browser-smoke.mjs#L385) | Admin | direct selected-date export |
| 17 | [role boundaries: admin is read-only, customer/staff see forbidden page content](../../scripts/browser-smoke.mjs#L403) | Admin / Customer / Staff | role boundaries |
| 18 | [unauthorised direct API calls return 401/403 with stable error shape](../../scripts/browser-smoke.mjs#L417) | Unauthenticated | API authentication |
| 19 | [cancel chain: confirm SKU007 order then cancel restores stock exactly once](../../scripts/browser-smoke.mjs#L439) | Customer / Staff | creation / confirmation / cancellation |
| 20 | [low stock warning disappears after staff replenishes 4→5, ledger records operator](../../scripts/browser-smoke.mjs#L477) | Staff | inventory |
| 21 | [replenishment ledger page shows delta/reason/order/operator](../../scripts/browser-smoke.mjs#L498) | Staff | inventory ledger |
| 22 | [network unknown on a write shows unknown state and recovers after refresh](../../scripts/browser-smoke.mjs#L509) | Customer / Staff | network recovery |
| 23 | [out-of-stock create shows readable error and writes nothing](../../scripts/browser-smoke.mjs#L540) | Customer | stock validation |
| 24 | [mobile 390: customer, staff and admin pages have no horizontal overflow](../../scripts/browser-smoke.mjs#L552) | Customer / Staff / Admin | mobile layout |
| 25 | [dark scheme remains usable](../../scripts/browser-smoke.mjs#L573) | Customer | appearance |
| 26 | [logout kills the session immediately](../../scripts/browser-smoke.mjs#L583) | Customer | sign-out |
