# Logistics Management System
COMP 3500SEF Software Engineering · Group 42 · Topic 1: Logistics Management System

> Course project. Final package (report + video + logbooks) due **2026-12-08**; the report's first page must link this repository.

## Team

| Member | Role | Main duty |
| --- | --- | --- |
| Tang Yi Jie (Lead) | Group Leader · Scrum Master · Requirements Lead · Lead Dev | SRS baseline, architecture decisions, final review, report, submission |
| Yin Pei Xu | Dev (core engine) | Order state machine, inventory logic, data layer |
| Tang Chao | Dev (UI) | Web UI, tracking page, report page |
| Yang Ting Zhang | Architecture & UML | Use-case/class/sequence diagrams, risk register |
| Wu Peng Bo | Docs & external | Meeting minutes, change log, SRS/report formatting |
| Chung Ngon Man | Test & QA | Test plan, 5-level test case tables |
| Li Mu Qiu | Test & QA | Test execution, evidence screenshots, usability walkthrough |

## Quick start

```
npm install
npx prisma migrate dev
npm run seed
npm run dev
```

## Docs index

- `docs/contracts/glossary.md` — 领域词汇表（一义一词，唯一真源）
- `docs/contracts/state-machine.md` — 订单状态机（枚举＋合法转移表）
- `docs/contracts/data-model.md` — 数据模型 v0（Prisma schema 草案）
- `docs/contracts/api.md` — API 契约 v0（端点表＋错误信封）
- `docs/traceability.md` — 需求 ID 与追踪矩阵
- `docs/process/git-workflow.md` — 分支/提交/PR 规约
- `docs/process/definition-of-done.md` — DoD 检查单
- `docs/process/change-control.md` + `CHANGELOG.md` — 变更控制与变更日志
- `docs/defects.md` — 缺陷日志；`docs/risks.md` — 风险台账
- `docs/acceptance.md` — Must 功能 GWT 验收场景；`docs/test-plan.md` — 五层测试计划
- `docs/templates/` — 会议纪要、三行报模板

## Rules

1. `main` is protected. No direct pushes; PR + review (module owner + lead final review) required.
2. Branch: `feat|fix|docs|test|chore/<issue#>-<slug>`; commit: `type(scope): summary (#issue)`.
3. Every PR references a requirement ID (FR-xx / NFR-xx) and passes CI.
4. Any interface change must update `api.md` + `lib/types.ts` in the same PR.
