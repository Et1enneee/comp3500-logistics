import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const script=path.resolve('scripts/soak-summary.mjs');
test('missing days remain visible and duplicate failed observations do not disappear',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'soak-summary-'));
  try {
    const rows=[{ts:'2026-11-11T00:00:00Z',ok:true,latencyMs:2},{ts:'2026-11-11T00:01:00Z',ok:false,latencyMs:7},{ts:'2026-11-11T00:05:00Z',ok:true,latencyMs:1}];
    await writeFile(path.join(dir,'2026-11-11.jsonl'),rows.map(JSON.stringify).join('\n')+'\n');
    execFileSync(process.execPath,[script,'2026-11-11','2026-11-12'],{env:{...process.env,SOAK_DIR:dir},stdio:'ignore'});
    const x=JSON.parse(await readFile(path.join(dir,'summary.json'),'utf8'));
    assert.equal(x.daily[0].expectedSlots,192); assert.equal(x.daily[0].observedSlots,2); assert.equal(x.daily[0].successfulSlots,1); assert.equal(x.daily[0].failedSlots,1); assert.equal(x.daily[0].missingSlots,190); assert.equal(x.daily[0].observedUptimePercent,50); assert.equal(x.daily[1].observedUptimePercent,null); assert.equal(x.total.missingSlots,382); assert.equal(x.total.incidentStarts,2);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
test('invalid records and dates cause an error',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'soak-summary-'));
  try { await writeFile(path.join(dir,'2026-11-11.jsonl'),'not-json\n'); assert.throws(()=>execFileSync(process.execPath,[script,'2026-11-11','2026-11-11'],{env:{...process.env,SOAK_DIR:dir},stdio:'ignore'})); assert.throws(()=>execFileSync(process.execPath,[script,'2026-02-30','2026-03-01'],{env:{...process.env,SOAK_DIR:dir},stdio:'ignore'})); } finally {await rm(dir,{recursive:true,force:true});}
});
