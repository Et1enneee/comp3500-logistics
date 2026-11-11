import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const snapshot = JSON.parse(await readFile(path.join(app, 'evidence/availability/actions-history.json'), 'utf8'));
const tri = (steps, ...names) => {
  const step = steps.find(s => names.includes(s.name));
  return step?.conclusion === 'success' ? true : step?.conclusion === 'failure' ? false : null;
};
const observations = snapshot.runs.map(r => {
  const steps = r.jobs?.flatMap(j => j.steps) ?? [];
  const buildOk = tri(steps, 'Production build', 'Run npm run build');
  const unit = tri(steps, 'Unit tests', 'Run npm test');
  const integration = tri(steps, 'Integration tests (real isolated SQLite)', 'Run npm run test:integration');
  const testsOk = unit === false || integration === false ? false : unit === true && integration === true ? true : null;
  const browserOk = tri(steps, 'Performance probe + browser acceptance (one server lifecycle)', 'Browser acceptance');
  const gate = tri(steps, 'Verify current source manifest');
  const classification = r.jobs === null ? 'step-details-unavailable' : r.conclusion === 'cancelled' ? 'cancelled' : gate === false ? 'manifest-gate-blocked' : testsOk === false ? 'test-failure' : browserOk === true ? 'browser-acceptance-passed' : r.conclusion === 'failure' ? 'other-ci-failure' : 'no-browser-result';
  return { ts:r.created_at, commit:r.head_sha, runId:r.id, event:r.event, conclusion:r.conclusion, manifestOk:gate, buildOk, testsOk, browserOk, classification, url:r.html_url };
});
const result = { retrievedAt:snapshot.retrievedAt, source:snapshot.source, scope:'CI job outcomes, not continuous service uptime; null means no successful or failed outcome is recorded for that step.', observations };
const dest=path.join(app,'evidence/availability/integration-observations.json');
await writeFile(dest, JSON.stringify(result,null,2)+'\n');
console.log(`runs=${observations.length} success=${observations.filter(x=>x.conclusion==='success').length} failure=${observations.filter(x=>x.conclusion==='failure').length} cancelled=${observations.filter(x=>x.conclusion==='cancelled').length} browser_pass=${observations.filter(x=>x.browserOk===true).length} missing_steps=${observations.filter(x=>x.classification==='step-details-unavailable').length}`);
