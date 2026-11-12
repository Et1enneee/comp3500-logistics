# Evidence intake runbook

Operator-owned procedure. Only actual observations will be added. All commands below run from the repository root unless a working directory is shown. New evidence artifacts and their report changes use the full evidence pipeline in [`report-baseline-procedure.md`](../../logistics-foundation/docs/process/report-baseline-procedure.md); mixed changes use the highest tier. Keep the original records and their limitations.

## SOAK — collect through 30 November

Use the real scripts [`soak-probe.mjs`](../../logistics-foundation/scripts/soak-probe.mjs), [`soak-summary.mjs`](../../logistics-foundation/scripts/soak-summary.mjs), and the [operator procedure](../../logistics-foundation/docs/availability-measurement.md). After the actual 30 November local observation window ends, in an operator checkout:

```sh
cd logistics-foundation
read -r -p 'Actual first observation date (YYYY-MM-DD): ' SOAK_START
node scripts/soak-summary.mjs "$SOAK_START" 2026-11-30
cat evidence/availability/summary.json
```

Retain the dated `evidence/availability/YYYY-MM-DD.jsonl` files. Each JSONL observation contains `ts` (UTC timestamp), `ok` (HTTP success) and `latencyMs`; the summary provides `total.successfulSlots`, `total.observedSlots`, `total.expectedSlots`, `total.missingSlots`, `total.observedUptimePercent`, and `total.conservativeWindowPercent`. Reconcile incidents with operator notes; missing slots are not successful samples. The `/login` loopback probe is a sampled entry-point measure, not whole-system uptime, and the existing integration-point criterion is not a deployed-service uptime measure.

§6 template, to be populated from the actual summary: “For the observed local-loopback `/login` window {{start}}–{{end}}, {{successful}} of {{observed}} observed five-minute slots succeeded ({{observed percentage}}%); {{missing}} of {{expected}} expected slots were missing, and the conservative window percentage was {{conservative percentage}}%.” Actual results will be added. Apply the full evidence pipeline.

## WALKTHROUGH — 17–24 November participant observations

Use the existing [moderator protocol](../../logistics-foundation/docs/user-validation/moderator.md), [role task cards](../../logistics-foundation/docs/user-validation/), and [record template](../../logistics-foundation/docs/user-validation/record-template.md). For each actual participant and task, copy the template to an operator-chosen evidence file and record the anonymous code, role, task and revision, date/time, application commit and environment, and the four outcomes below:

```text
Completed (yes / no / stopped and observed outcome): {{actual outcome}}
Errors (description and count): {{actual errors}}
Help requests (description and count): {{actual help requests}}
Elapsed time: {{actual elapsed time}}
```

Retain consent, criteria, actual major actions and observations as specified in the template; do not include names, contact details, credentials or real addresses. §8 template: “In the observed role tasks, {{participant count}} participants recorded {{completion outcomes}}, {{errors}}, {{help requests}} and {{elapsed times}} under the stated protocol.” Actual observations will be added. Apply the full evidence pipeline. Automated walkthrough counts are not participant results.

## RE-PROBE — 25 November post-fix measurement

Use the existing [`perf-probe.mjs`](../../logistics-foundation/scripts/perf-probe.mjs) against a production build on loopback, with the disposable demo database and application server running as in the [application setup](../../logistics-foundation/README.md). From `logistics-foundation/`:

```sh
cd logistics-foundation
PERF_BASE_URL=http://127.0.0.1:3100 PERF_OUTPUT="$PWD/evidence/performance-post-fix.json" node scripts/perf-probe.mjs
jq '{measuredAt,baseUrl,buildMode,environment,methodology,api,ui}' evidence/performance-post-fix.json
```

If Playwright's bundled Chromium is unavailable, set `CHROMIUM_PATH` to the actual local Chromium executable. Record the tested commit, environment, timestamp, samples and raw result; verify the build includes the export fix before replacing the historical qualification. §6 template: “In a post-export-fix local-loopback measurement at {{timestamp}} on {{tested commit}}, API p95 was {{measured range}} ms and first-contentful-paint p95 was {{measured range}} ms.” Actual results will be added. After verification, replace the old pre-export-fix description rather than presenting the earlier measurement as post-fix; retain its historical record. Apply the full evidence pipeline.

After the last dataset arrives, regenerate the final PDF. If the post-fix measurement and soak data are both available together, incorporate both in one evidence cycle and regenerate once; timing follows actual data arrival.
