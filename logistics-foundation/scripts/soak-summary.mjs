import fs from 'node:fs/promises';
import path from 'node:path';

// Hong Kong has no daylight-saving shifts; grouping uses the specified IANA zone.
const [start,end] = process.argv.slice(2);
const dateRe = /^\d{4}-\d{2}-\d{2}$/;
if (!dateRe.test(start || '') || !dateRe.test(end || '') || start > end || process.argv.length !== 4) throw new Error('Usage: node scripts/soak-summary.mjs YYYY-MM-DD YYYY-MM-DD');
for (const d of [start,end]) { const dt = new Date(`${d}T00:00:00Z`); if (!Number.isFinite(dt.getTime()) || dt.toISOString().slice(0,10) !== d) throw new Error(`Invalid calendar date: ${d}`); }
const dir = path.resolve(process.env.SOAK_DIR || 'evidence/availability');
const zone = process.env.SOAK_TZ || 'Asia/Hong_Kong';
if (zone !== 'Asia/Hong_Kong') throw new Error('Summary requires Asia/Hong_Kong; 192 slots assumes no daylight-saving shift');
const fmt = new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const parts = ts => Object.fromEntries(fmt.formatToParts(new Date(ts)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
const percent = (num,den) => den ? Number((100*num/den).toFixed(2)) : null;
const daily=[]; let incidents=0, previousBad=false;
for (let day=start;day<=end;) {
  const slots=Array.from({length:192},()=>[]);
  let text=''; try { text=await fs.readFile(path.join(dir, `${day}.jsonl`),'utf8'); } catch(e) { if(e.code!=='ENOENT') throw e; }
  for (const [i,line] of text.split('\n').entries()) {
    if (!line.trim()) continue;
    let r; try { r=JSON.parse(line); } catch { throw new Error(`${day}:${i+1} invalid JSON`); }
    if (!r || typeof r.ts!=='string' || !Number.isFinite(Date.parse(r.ts)) || typeof r.ok!=='boolean' || typeof r.latencyMs!=='number' || !Number.isFinite(r.latencyMs) || r.latencyMs<0) throw new Error(`${day}:${i+1} invalid observation`);
    const p=parts(r.ts), actual=`${p.year}-${p.month}-${p.day}`, hr=+p.hour, min=+p.minute;
    if(actual!==day || hr<8 || hr>=24) throw new Error(`${day}:${i+1} outside named day/window`);
    slots[(hr-8)*12+Math.floor(min/5)].push(r.ok);
  }
  const observed=slots.filter(x=>x.length).length, good=slots.filter(x=>x.length && x.every(Boolean)).length, failed=observed-good, missing=192-observed;
  let dayIncidents=0;
  for(const slot of slots) { const bad=!slot.length || slot.some(x=>!x); if(bad && !previousBad) { incidents++; dayIncidents++; } previousBad=bad; }
  daily.push({date:day,expectedSlots:192,observedSlots:observed,successfulSlots:good,failedSlots:failed,missingSlots:missing,observedUptimePercent:percent(good,observed),conservativeWindowPercent:percent(good,192),incidentStarts:dayIncidents});
  const d=new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate()+1); day=d.toISOString().slice(0,10);
}
const total=daily.reduce((a,d)=>{for(const k of ['expectedSlots','observedSlots','successfulSlots','failedSlots','missingSlots']) a[k]+=d[k];return a;},{expectedSlots:0,observedSlots:0,successfulSlots:0,failedSlots:0,missingSlots:0});
total.observedUptimePercent=percent(total.successfulSlots,total.observedSlots); total.conservativeWindowPercent=percent(total.successfulSlots,total.expectedSlots); total.incidentStarts=incidents;
const result={generatedAt:new Date().toISOString(),timezone:zone,window:'08:00 inclusive–24:00 exclusive',samplingMinutes:5,interpretation:'Observed uptime excludes missing slots; conservative window percentage counts missing as unavailable. Consecutive failed or missing slots form one incident; incident notes require operator review. Duplicate observations in a slot pass only when all are successful.',daily,total};
await fs.mkdir(dir,{recursive:true}); await fs.writeFile(path.join(dir,'summary.json'),JSON.stringify(result,null,2)+'\n'); console.log(JSON.stringify(result,null,2));
