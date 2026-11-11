import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

// One scheduled observation. Status codes, redirects and transport failures remain observations.
const base = new URL(process.env.SOAK_URL || 'http://127.0.0.1:3100/login');
if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(base.hostname)) throw new Error('SOAK_URL must be loopback');
const zone = process.env.SOAK_TZ || 'Asia/Hong_Kong';
const dir = path.resolve(process.env.SOAK_DIR || 'evidence/availability');
const timeout = Number(process.env.SOAK_TIMEOUT_MS || 10000);
if (!Number.isFinite(timeout) || timeout <= 0) throw new Error('Invalid SOAK_TIMEOUT_MS');
const now = new Date();
const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).formatToParts(now).filter(p => p.type !== 'literal').map(p => [p.type,p.value]));
if (+parts.hour < 8 || +parts.hour >= 24) { console.log('Outside 08:00–24:00 observation window'); process.exit(0); }
const date = `${parts.year}-${parts.month}-${parts.day}`;
const started = performance.now();
let ok = false;
try {
  const response = await fetch(base, { redirect:'manual', signal:AbortSignal.timeout(timeout) });
  ok = response.status === 200;
  await response.arrayBuffer();
} catch { ok = false; }
const observation = { ts:now.toISOString(), ok, latencyMs: Number((performance.now() - started).toFixed(1)) };
await fs.mkdir(dir, { recursive:true });
await fs.appendFile(path.join(dir, `${date}.jsonl`), JSON.stringify(observation) + '\n');
console.log(JSON.stringify(observation));
if (!ok) process.exitCode = 1;
