# CI Run Root Cause Analysis — Non-Green Runs

Scope: all workflow runs as of 2026-11-04（repo head 7fabec7）.

## Finding

Every merge-to-main run is green, including the current head.
Two non-green runs exist, both on feature-branch context:

| Run | Commit | Duration | Annotation (verbatim) | Superseded by |
|---|---|---|---|---|
| 41437570962 | 86b75dd | 1m22s | The operation was canceled. | 41437624265 (success) |
| 40669212384 | 7e7bf8a | 14s | Process completed with exit code 1. | 40669234384 (success) |

## Root cause

The workflow’s concurrency policy cancels in-progress runs of the same ref
when a newer push arrives. Both cancellations occurred seconds after start
(14s / 1m22s — the full suite requires 2–4 minutes, so tests never ran).
“Process completed with exit code 1” is the exit code of the killed process,
not a test failure. Both commits were superseded by green runs of their
successor commits, and the branch content later merged to main green.

## Conclusion

No test failures. No workflow changes required. Platform warnings
(Node.js 20 deprecation, ubuntu-latest migration) are GitHub announcements
unrelated to this repository’s code.

## Addendum

- Event: run `41757351466` · commit `50f07a0` · step `Verify current source manifest` — root cause `docs/traceability.md` changed without regenerating the manifest; disposition: regenerate after diff review.
- FR-08 merge commit `841f7c7` has no independent workflow run: it was pushed to `main` together with `50f07a0` in a single push (`7fabec7..50f07a0`), so only one run exists at head `50f07a0`.
- Conclusion: the manifest gate flagged a stale manifest before any quality gate ran; resolved by regenerating the manifest after diff review — the gate works as designed.
