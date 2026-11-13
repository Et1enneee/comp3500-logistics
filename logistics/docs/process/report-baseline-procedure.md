# Report baseline procedure

## Change classification

Apply the highest applicable tier to a mixed change:

1. **Full evidence pipeline:** application code, tests, or substantive evidence artifacts change. New soak observations, participant walkthrough results, and post-fix performance measurements are evidence changes; record actual observations only. When such evidence is incorporated into a report, the mixed change follows this tier.
2. **Rendering pipeline:** only the text of the canonical long report (`docs/final-report.md`) and/or its submission source (`docs/submission/report.md`) changes, without an application, test, or substantive evidence change. The existing evidence baseline remains unchanged. Check changed claims, numbers, qualifications and links against the existing evidence; reconcile the two report carriers before rendering. A textual claim is not a substitute for new measurement.
3. **Baseline-neutral:** only process artifacts such as checklists, cards, packet instructions, or this procedure change. Presentation-deck files are outside these trigger tiers and remain frozen under the current project instruction. For a baseline-neutral PR, successful PR CI satisfies its regression requirement; do not create an evidence-log commit, repin the baseline, or regenerate the PDF solely for that change.

Changes not clearly covered by the rendering or baseline-neutral tiers use the full evidence pipeline. A process file cannot be used to hide an application, test, report-source, or substantive evidence change.

## Full evidence pipeline

1. Commit the application, test, or substantive evidence changes and any related report-source changes.
2. Run the full regression suite: `npm test`, `npm run test:integration`, `npm run test:integrity`, `npm run build`, and `npm run test:browser`. Commit the resulting evidence logs and supporting evidence.
3. Verify successful CI for the evidence commit. Pin `hardened_evidence_commit` in `logistics/BASELINE-final-report.json` to the latest commit containing test logs or substantive evidence, and record the actual CI run. Complete the pin in the same PR as the evidence change.
4. Run the rendering pipeline below, generating the PDF last with §10 referencing that evidence commit. Verify the PDF §10 value, baseline JSON and evidence commit on main after merge.

## Rendering pipeline

After source edits and, when applicable, the evidence pin: regenerate `docs/submission/report.pdf`; run the strict word-count script; record the PDF SHA-256; audit its links; and verify that PDF §10 still agrees with the baseline JSON and the intended evidence commit. A text-only change does not create an evidence-log commit or move the baseline. Recheck the generated PDF using the operator print and cold-read procedures as applicable; automated checks do not establish human readability.

The baseline JSON and process-only files are metadata, not themselves new evidence commits. A PDF or its metadata committed after the evidence commit does not change the meaning of the evidence baseline. Do not treat a CI pass or an automated walkthrough as participant observation or a long-duration availability measurement.

## Reconciliation record

On 12 November 2026, PR #22 added only a print checklist and cold-read card. Its PR CI and local full regression passed. These process-only changes did not move the evidence baseline; creating another log commit solely to repin the same evidence would add churn. PR #23 recorded that distinction. This revision further separates report-text rendering from application, test and evidence changes, while preserving highest-tier handling for mixed changes. When asking for a decision that constrains merging, wait for that decision before merging.
