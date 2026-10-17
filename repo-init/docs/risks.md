# Risk Register · docs/risks.md (v0, 8 risks)

> Owner: Yang Ting Zhang. Reviewed at every weekly stand-up; new risks are logged in the meeting.
> RK-06 to RK-08 were added on 15 October 2026 by Yang Ting Zhang (design / architecture). RK-01 to RK-05 are the existing entries, translated to keep the file in one language; their content is unchanged, except RK-04 whose wording was corrected as noted below.

| Risk-ID | Risk | Probability | Impact | Mitigation | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- |
| RK-01 | The seven members' schedules rarely align, so there may be nothing to show before a progress review | Medium | High | Contract-first, a Wednesday checkpoint and the Sunday three-line report; anyone falling behind is paired up immediately | Lead | Open |
| RK-02 | Rework of the state machine or the interfaces, caused by changes made without a contract | Medium | High | One definition in three places, the documentation gate and change control | Yin | Mitigated |
| RK-03 | Test week (24 November) dilutes development capacity | High | Medium | Sprint 2 load-shedding; the Must chain must be green by 17 November | Lead | Open |
| RK-04 | Delay in the CI and local development environment | Low | Medium | CI skeleton in week 1; a local environment checklist with one-command database setup and seed before 26 October. No deployment is planned, so this risk covers the local machine and CI only. | Lead | Open |
| RK-05 | Demo data cannot be reproduced | Low | High | Fixed seed data in seed.ts (50 orders, 10 SKUs, 3 roles) | Yin | Open |
| RK-06 | Assignments and the test squeeze project time: the group's internal delivery date for Assignment 1 is 19 October and the course submission deadline is 20 October, while the test falls on 24 November, so both peaks collide with Sprints 1 and 2 and progress may stall before a review | High | High | Schedule around both peaks: keep the Must-chain cards outside the week of 19 October; in test week run acceptance and documentation only and start no new feature; keep the Wednesday checkpoint with a hard Thursday deliverable and pair up anyone who falls behind | Lead | Open |
| RK-07 | Slow ramp-up on Next.js: most of the seven are new to Next.js 14, Prisma and TypeScript, so the app-router and API-route conventions have to be learned from scratch and week 1 may produce only a skeleton | High | Medium | The Newcomer Run Guide and the week-1 code package are already provided by the team as scaffolding; week 1 only asks each member to run and read the existing code and take one small card; pair programming, with the first person to finish leaving a three-line note in the group | Yang Ting Zhang | Open |
| RK-08 | The December video may not fit: the course requires a 15 to 25 minute recorded presentation and a report of at most 1000 words, both due 8 December 2026, alongside the final logbook and the examination period, and members' departure plans are not yet fixed | Medium | High | Freeze the demo script and storyboard by 17 November; record a full rehearsal around 24 November, recording first and polishing afterwards; lock the final cut by 1 December; run the report and the logbook in parallel under Wu Peng Bo so that neither is pushed into the last week | Lead and Wu Peng Bo | Open |

## Notes for the group lead

- The file holds eight risks (RK-01 to RK-08), which satisfies acceptance criterion 3 of card-03.
- **RK-04 provenance and wording.** This entry comes from the earlier template, so it is not a new addition. Its wording was corrected from a hosting rehearsal to a local-environment and CI risk, because the group does not deploy.
- **RK-06 dates.** The internal delivery date for Assignment 1 is 19 October and the course submission deadline is 20 October; the two are now stated separately so that neither is mistaken for the other. The test date is 24 November, as recorded in RK-03.
- **RK-07 provenance.** The Newcomer Run Guide and the week-1 code package are described as already provided by the team. The risk is owned by Yang Ting Zhang and can be reassigned if the group prefers a single owner for tooling risks.
- **RK-08 course basis.** The figures are not estimates. The course introduction requires a 15 to 25 minute recorded presentation (Project Presentation 2/2 slide) and a report of not more than 1000 words excluding source code (Project Report slide), both due 8 December 2026.
- **RK-05 open point.** The mitigation states 50 seeded orders, but prisma/seed.ts currently creates 3 users and 10 products and no orders. The registered mitigation is therefore not yet met; this is recorded, not changed.

## Course basis quoted for RK-08

| Item | Requirement | Source |
| --- | --- | --- |
| Project presentation video | 15 to 25 minutes, recorded | Course Introduction, Project Presentation (2/2) slide |
| Project report length | Not more than 1000 words, source code excluded from the count | Course Introduction, Project Report slide |
| Report deadline | 8 December 2026 | Course Introduction, Project Report slide |
