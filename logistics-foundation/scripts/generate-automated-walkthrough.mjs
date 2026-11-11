import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source=await readFile(path.join(root,'scripts/browser-smoke.mjs'),'utf8');
const log=await readFile(path.join(root,'evidence/test-logs/2026-11-11-final-repair/browser.log'),'utf8');
const lines=source.split('\n');
const checks=[...source.matchAll(/await check\("([^"\n]+)"/g)].map(m=>m[1]);
const passed=[...log.matchAll(/^PASS (.+)$/gm)].map(m=>m[1]);
if(checks.length!==26 || passed.length!==26 || checks.some(n=>!passed.includes(n)) || !log.includes('EXIT_CODE=0')) throw Error('Browser log and source check list do not match');
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
 ['Admin','Export selected dates without applying filter','admin exports selected dates without applying the filter',['locator("#from").fill','locator("#to").fill','name: "Export Selected Dates as CSV" }).click']],
];
let output='# Automated operation walkthrough\n\nGenerated from the browser script and its dated execution log. Reproduce from the repository root with `node logistics-foundation/scripts/generate-automated-walkthrough.mjs`. One action is one scripted fill, selection or click on a relevant control. Each operation starts on the target screen with an authenticated role and a prepared fixture; login, navigation, waits, assertions, errors, and setup are outside the per-operation count. The checks include error and security cases, not 26 user journeys. The listed successful operations are a selected subset; automated actions do not measure human completion, errors, assistance or time.\n\n| Role | Operation (browser check) | Actions | ≤3? |\n|---|---|---:|---|\n';
for(const [role,operation,check,frags] of rows){
 const start=lines.findIndex(l=>l.includes(`await check("${check}"`));
 if(start<0 || !passed.includes(check)) throw Error(`Missing passed check: ${check}`);
 let end=lines.findIndex((l,i)=>i>start && l.includes('await check("')); if(end<0) end=lines.length;
 for(const frag of frags){const matches=lines.slice(start,end).filter(l=>l.includes(frag));if(matches.length!==1) throw Error(`Expected one action for ${operation}: ${frag}, found ${matches.length}`);}
 output+=`| ${role} | ${operation} ([${check}](../../scripts/browser-smoke.mjs#L${start+1})) | ${frags.length} | ${frags.length<=3?'Yes':'No'} |\n`;
}
output+='\nThe full customer creation check also tests an invalid submission before correction; the table instead selects the separate successful order-creation segment in the cancellation check. The staff confirmation regression deliberately exercises a Back action; the table uses the separate successful confirmation segment. The earlier filter-then-export sequence comprises four interactions. The direct export of selected dates takes three interactions: fill both dates and export, without applying the filter. From a screen with the desired dates already entered, export is one click. The direct API export assertion is additional to the actual browser download click.\n\n[Browser execution log](../test-logs/2026-11-11-final-repair/browser.log) records the check results. [Human validation protocol](../../docs/user-validation/moderator.md) provides a separate method for assessing fitness for purpose.\n';
const roles=['Customer / Staff / Admin','Unauthenticated / Customer','Admin / Customer','Customer','Staff / Driver','Customer','Customer','Customer','Staff','Staff','Staff','Staff','Staff / Customer','Customer','Admin','Admin','Admin / Customer / Staff','Unauthenticated','Customer / Staff','Staff','Staff','Customer / Staff','Customer','Customer / Staff / Admin','Customer','Customer'];
const groups=['list validation','authentication','report / sign-out recovery','sign-in','assignment / delivery','order creation and error handling','order detail','ownership security','order queue','confirmation regression','picking / shipping','delivery recovery','delivery / tracking','notifications','report filter / export','direct selected-date export','role boundaries','API authentication','creation / confirmation / cancellation','inventory','inventory ledger','network recovery','stock validation','mobile layout','appearance','sign-out'];
const expected='faf47281300e71f3e975ff6530b188e9abc0a772d2e69954c4848945b3abab8e';
if(createHash('sha256').update(checks.join('\n')).digest('hex')!==expected || roles.length!==checks.length || groups.length!==checks.length) throw Error('Update check-to-role mapping after a browser suite change');
output+='\n## Complete browser-check map\n\nThese check IDs are the source-order indices in the test suite. Cross-cutting and recovery checks are shown as such; their presence does not imply an independently timed human journey.\n\n| ID | Check | Role or actor | Coverage |\n|---:|---|---|---|\n';
for(let i=0;i<checks.length;i++){const line=lines.findIndex(l=>l.includes(`await check("${checks[i]}"`))+1;output+=`| ${i+1} | [${checks[i]}](../../scripts/browser-smoke.mjs#L${line}) | ${roles[i]} | ${groups[i]} |\n`;}
await writeFile(path.join(root,'evidence/user-validation/automated-walkthrough.md'),output);console.log(`checks=${checks.length} passed=${passed.length} operations=${rows.length} operations_over_3=${rows.filter(r=>r[3].length>3).length}`);
