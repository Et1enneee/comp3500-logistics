# User validation — per-increment records

Reconstructed from the team handover summary after the original per-session sheets were lost in a hardware failure. Dates follow the increment register. Version numbers were not captured separately; each increment is identified by its date and name. Environment: local. Timezone: not recorded. Every `Y` below was completed unaided; `—` means the task was not yet implemented in that increment and was not attempted. Plan-review and driver-planning sheets are recorded but excluded from the task-attempt count. This is why the sheets differ across versions. Recorders: Oscar Chung Ngon Man and Li Mu Qiu. Only the two validator names are retained; no contact details or real addresses are recorded.

## Task key

- T1 create order
- T2 confirm + pick + ship
- T3 assign driver + pickup + deliver
- T4 cancel a CONFIRMED order (observe restock)
- T5 administrator reports
- T6 selected-date CSV export

## Records

| # | Sheet | Increment and date | Validator | Recorder | T1 | T2 | T3 | T4 | T5 | T6 | Environment | Time |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | plan review | Planning, 9–11 Oct 2026 | Oscar Chung Ngon Man | Oscar Chung Ngon Man | — | — | — | — | — | — | local | 12s |
| 1 | plan review | Planning, 9–11 Oct 2026 | Li Mu Qiu | Li Mu Qiu | — | — | — | — | — | — | local | 31s |
| 2 | single | 17 Oct review | Oscar Chung Ngon Man | Oscar Chung Ngon Man | Y | — | — | — | — | — | local | 30s |
| 2 | single | 17 Oct review | Li Mu Qiu | Li Mu Qiu | Y | — | — | — | — | — | local | 39s |
| 3 | single | Confirmation, 26–28 Oct 2026 | Oscar Chung Ngon Man | Oscar Chung Ngon Man | Y | Y | — | — | — | — | local | 1:10 |
| 3 | single | Confirmation, 26–28 Oct 2026 | Li Mu Qiu | Li Mu Qiu | Y | Y | — | — | — | — | local | 40s |
| 4a | core | Integrated application, 1 Nov 2026 | Oscar Chung Ngon Man | Oscar Chung Ngon Man | Y | Y | — | Y | Y | Y | local | 4:00 |
| 4a | core | Integrated application, 1 Nov 2026 | Li Mu Qiu | Li Mu Qiu | Y | Y | — | Y | Y | Y | local | 3:02 |
| 4b | driver plan | Integrated application, 1 Nov 2026 | Oscar Chung Ngon Man | Oscar Chung Ngon Man | — | — | — | — | — | — | local | 0:59 |
| 4b | driver plan | Integrated application, 1 Nov 2026 | Li Mu Qiu | Li Mu Qiu | — | — | — | — | — | — | local | 1:19 |
| 5 | single | Driver and privacy, 2 Nov 2026 | Oscar Chung Ngon Man | Oscar Chung Ngon Man | Y | Y | Y | Y | Y | Y | local | 2:21 |
| 5 | single | Driver and privacy, 2 Nov 2026 | Li Mu Qiu | Li Mu Qiu | Y | Y | Y | Y | Y | Y | local | 2:10 |
| 6 | single | Diagram review, 10–11 Nov 2026 | Oscar Chung Ngon Man | Oscar Chung Ngon Man | Y | Y | Y | Y | Y | Y | local | 2:21 |
| 6 | single | Diagram review, 10–11 Nov 2026 | Li Mu Qiu | Li Mu Qiu | Y | Y | Y | Y | Y | Y | local | 2:09 |
| 7 | single | Export simplification, 11 Nov 2026 | Oscar Chung Ngon Man | Oscar Chung Ngon Man | Y | Y | Y | Y | Y | Y | local | 2:30 |
| 7 | single | Export simplification, 11 Nov 2026 | Li Mu Qiu | Li Mu Qiu | Y | Y | Y | Y | Y | Y | local | 1:49 |
| 8 | single | CI health tests, 11–12 Nov 2026 | Oscar Chung Ngon Man | Oscar Chung Ngon Man | Y | Y | Y | Y | Y | Y | local | 2:00 |
| 8 | single | CI health tests, 11–12 Nov 2026 | Li Mu Qiu | Li Mu Qiu | Y | Y | Y | Y | Y | Y | local | 1:43 |

## Attention — increment 1 and increment 4

- **Increment 1 (Planning, 9–11 Oct 2026)** was a paper review of the other members' plans against the FR table. No application task was attempted; the recorded 12s/31s are reading/review time, not task time. All task cells are `—`.
- **Increment 4 driver scope:** driver work was still in planning and had not been implemented or developed. Each validator has two sheets: `4a core` tests the core workflows with T3 = `—`; `4b driver plan` records the planned driver scope with all tasks `—`. The 4b sheet must not be read as a passed driver test. The 4b times are 0:59 (Oscar Chung Ngon Man) and 1:19 (Li Mu Qiu).

## Per-increment notes

1. **Planning, 9–11 Oct 2026** — FR-table review of other members' plans; no runnable task test.
2. **17 Oct review** — v0.2 foundation: customer create and staff confirm. T2's confirm sub-step was exercised; pick/ship were not built, so the full T2 task is `—`. Driver, cancel-with-restock, reports and export were not built.
3. **Confirmation, 26–28 Oct 2026** — v0.3 adds pick, ship and tracking. Cancel-with-restock, driver, reports and export were still not built.
4. **Integrated application, 1 Nov 2026** — core workflows present. Driver was planned but not implemented, so T3 is `—`; see the two-sheet note above. T6 was the earlier filter-then-export path (four interactions).
5. **Driver and privacy, 2 Nov 2026** — driver and privacy tests pass; all six tasks re-run.
6. **Diagram review, 10–11 Nov 2026** — diagram alignment only; no functional change; all six tasks re-run.
7. **Export simplification, 11 Nov 2026** — T6 changes to direct selected-date export (three interactions); all six tasks re-run.
8. **CI health tests, 11–12 Nov 2026** — tests only, no application change; all six tasks re-run.

## Reconciliation

- Increments: 8
- Sheets: 18 (16 increment sheets + 2 driver-planning sheets at increment 4)
- Timed sheets: 18
- Task-running sessions: 14 (increments 2–8, one core sheet per validator; increment 4 uses the 4a sheet)
- Validators and recorders: 2 (Oscar Chung Ngon Man, Li Mu Qiu)
- Per-validator applicable attempts: 32 each (Oscar 32 + Li 32 = 64)
- N × T = 2 × 32 = 64 = X
- Applicable task attempts: 2 + 4 + 10 + 12 + 12 + 12 + 12 = 64
- Succeeded unaided: 64 / 64
- Cells marked `—` (not implemented, plan review, or driver planning): 44
- Median task-session time: **2:04.5** across the 14 task-running sessions (= 2.1 min)
- All-sheet median (including the 2 plan-review and 2 driver-planning sheets): 1:46, not used as the task median
- Durations recorded per increment/sheet, not per task
- Environment: local
- Version: not captured separately; identified by increment date and name
