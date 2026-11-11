import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source=await readFile(path.join(root,'scripts/browser-smoke.mjs'),'utf8');
const log=await readFile(path.join(root,'evidence/test-logs/2026-11-11-archaeology/browser.log'),'utf8');
const lines=source.split('\n');
const checks=[...source.matchAll(/await check\("([^"\n]+)"/g)].map(m=>m[1]);
const passed=[...log.matchAll(/^PASS (.+)$/gm)].map(m=>m[1]);
if(checks.length!==25 || passed.length!==25 || checks.some(n=>!passed.includes(n)) || !log.includes('EXIT_CODE=0')) throw Error('Browser log and source check list do not match');
const rows=[
 ['Customer','Create an order','cancel chain: confirm SKU007 order then cancel restores stock exactly once',['getByLabel("Delivery address").fill','getByLabel("SKU007 quantity").fill','name: "Place Order", exact: true }).click']],
 ['Customer','Open order details','customer order detail shows empty-shipment state (no stack trace)',['name: "View Order Details →" }).click']],
 ['Staff','Confirm order','cancel chain: confirm SKU007 order then cancel restores stock exactly once',['name: "Confirm Order", exact: true }).click','name: "Confirm Stock Deduction", exact: true }).click']],
 ['Staff','Start picking','staff pick → ship generates unique LG waybill, stock not touched again',['name: "Start Picking" }).click']],
 ['Staff','Ship order','staff pick → ship generates unique LG waybill, stock not touched again',['locator("#carrier").fill','name: "Ship Order" }).click']],
 ['Staff','Assign driver','staff assigns a shipped order and driver completes simulated delivery',['locator("#driver-select").selectOption','name: "Assign Driver" }).click']],
 ['Driver','Simulate pickup','staff assigns a shipped order and driver completes simulated delivery',['name: "Simulate Pickup" }).click']],
 ['Driver','Simulate delivery','staff assigns a shipped order and driver completes simulated delivery',['name: "Simulate Delivery" }).click']],
 ['Admin','Apply report date filter','admin dashboard matches database aggregates and exports CSV',['locator("#from").fill','locator("#to").fill','name: "Apply Filters" }).click']],
 ['Admin','Export current report','admin dashboard matches database aggregates and exports CSV',['name: "Export Current Filter as CSV" }).click']],
];
let output='# Automated operation walkthrough\n\nGenerated from the browser script and its dated execution log. Reproduce from the repository root with `node logistics-foundation/scripts/generate-automated-walkthrough.mjs`. One action is one scripted fill, selection or click on a relevant control. Each operation starts on the target screen with an authenticated role and a prepared fixture; login, navigation, waits, assertions, errors, and setup are outside the per-operation count. The checks include error and security cases, not 25 user journeys. The listed successful operations are a selected subset; automated actions do not measure human completion, errors, assistance or time.\n\n| Role | Operation (browser check) | Actions | ≤3? |\n|---|---|---:|---|\n';
for(const [role,operation,check,frags] of rows){
 const start=lines.findIndex(l=>l.includes(`await check("${check}"`));
 if(start<0 || !passed.includes(check)) throw Error(`Missing passed check: ${check}`);
 let end=lines.findIndex((l,i)=>i>start && l.includes('await check("')); if(end<0) end=lines.length;
 for(const frag of frags){const matches=lines.slice(start,end).filter(l=>l.includes(frag));if(matches.length!==1) throw Error(`Expected one action for ${operation}: ${frag}, found ${matches.length}`);}
 output+=`| ${role} | ${operation} ([${check}](../../scripts/browser-smoke.mjs#L${start+1})) | ${frags.length} | ${frags.length<=3?'Yes':'No'} |\n`;
}
output+='\nThe full customer creation check also tests an invalid submission before correction; the table instead selects the separate successful order-creation segment in the cancellation check. The staff confirmation regression deliberately exercises a Back action; the table uses the separate successful confirmation segment. The admin filter and export scenario comprises four interactions in total: three for filtering and one for export. The direct API export assertion is additional to the actual browser download click.\n\n[Browser execution log](../test-logs/2026-11-11-archaeology/browser.log) records the check results. [Human validation protocol](../../docs/user-validation/moderator.md) provides a separate method for assessing fitness for purpose.\n';
await writeFile(path.join(root,'evidence/user-validation/automated-walkthrough.md'),output);console.log(`checks=${checks.length} passed=${passed.length} operations=${rows.length} operations_over_3=${rows.filter(r=>r[3].length>3).length}`);
