# Automated operation walkthrough

Generated from the browser script and its dated execution log. Reproduce from the repository root with `node logistics-foundation/scripts/generate-automated-walkthrough.mjs`. One action is one scripted fill, selection or click on a relevant control. Each operation starts on the target screen with an authenticated role and a prepared fixture; login, navigation, waits, assertions, errors, and setup are outside the per-operation count. The checks include error and security cases, not 25 user journeys. The listed successful operations are a selected subset; automated actions do not measure human completion, errors, assistance or time.

| Role | Operation (browser check) | Actions | ≤3? |
|---|---|---:|---|
| Customer | Create an order ([cancel chain: confirm SKU007 order then cancel restores stock exactly once](../../scripts/browser-smoke.mjs#L421)) | 3 | Yes |
| Customer | Open order details ([customer order detail shows empty-shipment state (no stack trace)](../../scripts/browser-smoke.mjs#L217)) | 1 | Yes |
| Staff | Confirm order ([cancel chain: confirm SKU007 order then cancel restores stock exactly once](../../scripts/browser-smoke.mjs#L421)) | 2 | Yes |
| Staff | Start picking ([staff pick → ship generates unique LG waybill, stock not touched again](../../scripts/browser-smoke.mjs#L285)) | 1 | Yes |
| Staff | Ship order ([staff pick → ship generates unique LG waybill, stock not touched again](../../scripts/browser-smoke.mjs#L285)) | 2 | Yes |
| Staff | Assign driver ([staff assigns a shipped order and driver completes simulated delivery](../../scripts/browser-smoke.mjs#L164)) | 2 | Yes |
| Driver | Simulate pickup ([staff assigns a shipped order and driver completes simulated delivery](../../scripts/browser-smoke.mjs#L164)) | 1 | Yes |
| Driver | Simulate delivery ([staff assigns a shipped order and driver completes simulated delivery](../../scripts/browser-smoke.mjs#L164)) | 1 | Yes |
| Admin | Apply report date filter ([admin dashboard matches database aggregates and exports CSV](../../scripts/browser-smoke.mjs#L345)) | 3 | Yes |
| Admin | Export current report ([admin dashboard matches database aggregates and exports CSV](../../scripts/browser-smoke.mjs#L345)) | 1 | Yes |

The full customer creation check also tests an invalid submission before correction; the table instead selects the separate successful order-creation segment in the cancellation check. The staff confirmation regression deliberately exercises a Back action; the table uses the separate successful confirmation segment. The admin filter and export scenario comprises four interactions in total: three for filtering and one for export. The direct API export assertion is additional to the actual browser download click.

[Browser execution log](../test-logs/2026-11-11-archaeology/browser.log) records the check results. [Human validation protocol](../../docs/user-validation/moderator.md) provides a separate method for assessing fitness for purpose.
