# Report baseline procedure

## Trigger and scope

Apply the full report pipeline when application code, the canonical long report (`docs/final-report.md`), its rendering source (`docs/submission/report.md`), or substantive evidence supporting a report claim changes. New soak observations, participant walkthrough results, and a post-fix performance measurement are evidence changes; when incorporated into the report, they follow the full pipeline. Record actual observations only.

Process-only artifacts such as checklists, cards, packet instructions, and this procedure are baseline-neutral when they do not change application code, report rendering sources, or evidence. Presentation-deck files are outside this trigger scope and remain frozen under the current project instruction. For baseline-neutral changes, a successful PR CI run satisfies the regression requirement; do not create a new evidence-log commit, repin the baseline, or regenerate the PDF solely for that change. If a change mixes process files with a trigger-scope change, apply the full pipeline to the whole change.

## Full pipeline

1. Commit the application, report-source, or substantive evidence changes.
2. Run the full regression suite: `npm test`, `npm run test:integration`, `npm run test:delivery`, `npm run build`, and `npm run test:browser`. Commit the resulting evidence logs and any supporting evidence.
3. Verify successful CI for the evidence commit. Pin `hardened_evidence_commit` in `logistics-foundation/BASELINE-final-report.json` to the latest commit containing test logs or substantive evidence, and record the actual CI run. Complete the pin in the same PR as the evidence change.
4. Generate the PDF last, with §10 referencing the same evidence commit. Record its word count and SHA-256, and verify the PDF §10 value, baseline JSON and evidence commit on main after merge. Subsequent application, report-source or substantive evidence changes require the full pipeline again.

The baseline JSON and process-only files are metadata, not themselves new evidence commits. A PDF or its metadata committed after the evidence commit does not change the meaning of the evidence baseline. Do not treat a CI pass or an automated walkthrough as participant observation or a long-duration availability measurement.

## Reconciliation record

On 12 November 2026, PR #22 added only a print checklist and cold-read card. Its PR CI and local full regression passed. These process-only changes did not move the evidence baseline; creating another log commit solely to repin the same evidence would add churn. The earlier instruction stating that every repository change requires a new log commit is superseded by the trigger scope above. When asking for a decision that constrains merging, wait for that decision before merging.
