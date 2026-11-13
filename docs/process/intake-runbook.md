# Evidence intake runbook

Operator-owned procedure. Only actual observations are added. All commands below run from the repository root unless a working directory is shown. New evidence artifacts and their report changes use the full evidence pipeline in [`report-baseline-procedure.md`](../../logistics/docs/process/report-baseline-procedure.md); mixed changes use the highest tier. Keep the original records and their limitations.

## WALKTHROUGH — 17–24 November participant observations

Use the existing [moderator protocol](../../logistics/docs/walkthrough/moderator.md), [role task cards](../../logistics/docs/walkthrough/), and [record template](../../logistics/docs/walkthrough/record-template.md). For each actual participant and task, copy the template to an operator-chosen evidence file and record the anonymous code, role, task and revision, date/time, application commit and environment, and the four outcomes below:

```text
Completed (yes / no / stopped and observed outcome): {{actual outcome}}
Errors (description and count): {{actual errors}}
Help requests (description and count): {{actual help requests}}
Elapsed time: {{actual elapsed time}}
```

Retain consent, criteria, actual major actions and observations as specified in the template; do not include names, contact details, credentials or real addresses. §8 template: “In the observed role tasks, {{participant count}} participants recorded {{completion outcomes}}, {{errors}}, {{help requests}} and {{elapsed times}} under the stated protocol.” Actual observations are added. Apply the full evidence pipeline. Automated walkthrough counts are not participant results.

## RE-PROBE — 25 November post-fix measurement

Use the existing [`perf-probe.mjs`](../../logistics/scripts/perf-probe.mjs) against a production build on loopback, with the disposable demo database and application server running as in the [application setup](../../logistics/README.md). From `logistics/`:

```sh
cd logistics
PERF_BASE_URL=http://127.0.0.1:3100 PERF_OUTPUT="$PWD/evidence/performance-post-fix.json" node scripts/perf-probe.mjs
jq '{measuredAt,baseUrl,buildMode,environment,methodology,api,ui}' evidence/performance-post-fix.json
```

If Playwright's bundled Chromium is unavailable, set `CHROMIUM_PATH` to the actual local Chromium executable. Record the tested commit, environment, timestamp, samples and raw result; verify the build includes the export fix before replacing the historical qualification. §6 template: “In a post-export-fix local-loopback measurement at {{timestamp}} on {{tested commit}}, API p95 was {{measured range}} ms and first-contentful-paint p95 was {{measured range}} ms.” Actual results are added. After verification, replace the earlier measurement description rather than presenting it as post-fix; retain its historical record. Apply the full evidence pipeline.

After the last dataset arrives, regenerate the final PDF. If the post-fix measurement and participant observations are both available together, incorporate both in one evidence cycle and regenerate once; timing follows actual data arrival.
