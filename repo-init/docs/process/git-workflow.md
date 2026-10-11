# 仓库规约 · 分支 / 提交 / PR (v0)

## 分支

- `main` 受保护，**禁直推**；一切合并经 PR。
- 分支名：`feat|fix|docs|test|chore/<issue#>-<slug>`，例：`feat/12-order-status`。
- 一分支一事，不夹带。

## 提交

- 格式：`type(scope): summary (#issue)`，例：`feat(order): create order endpoint (#12)`。
- 中文摘要、英文 type 或全英文皆可；不许空提交、不许一坨提交（一个逻辑变更一提交）。

## PR

- 必须关联 Issue + 关联需求 ID（FR-xx/NFR-xx）＋ DoD 自检；界面类必附截图。
- 评审：模块 owner 评审 → **组长终审** → 过 CI（lint + tsc + test）→ 才可 merge。
- 模板见 `.github/pull_request_template.md`。

## 目录

```
logistics-system/
├─ app/           页面与 /api/v1 路由
├─ lib/           共享业务逻辑（状态机、校验）＋ types.ts
├─ prisma/        schema.prisma ＋ seed.ts
├─ docs/          SRS、契约、UML、台账与模板
├─ tests/         五层用例与脚本
└─ .github/workflows/ci.yml
```
