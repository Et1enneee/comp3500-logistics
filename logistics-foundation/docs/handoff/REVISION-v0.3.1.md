# v0.3.1 封版修订记录

日期：2026-10-28（本机）。底座：v0.3 候选 ZIP（SHA-256 `c0d76987c75469661272754a43365b1c57babb9e4a162182dae016b0e91412f1`）。
范围：仅四项封版修订；**未新增功能、未改 schema、未升级依赖、未合并远端**。

## 修订项

1. **范围文案同步**：页面横幅、README、FOUNDATION 交接范围更新为“下单/查询/确认/拣货/发货/追踪”，保留“本地模拟、非真实认证”。
2. **追踪读取失败反馈**：仅 `SHIPMENT_NOT_FOUND` 视为空；500/网络错误提示；已成功的状态操作不误报失败、不诱导重复提交。新增浏览器回归。
3. **证据与日志**：本轮 typecheck/unit/integration/lint/build/browser/server 日志收入 `docs/verification-logs/v0.3.1/`；历史证据归档到 `docs/evidence-history/v0.2-v0.3/`；v0.2 清单归档为 `docs/handoff/SHA256SUMS-v0.2.txt`。
4. **版本与摘要**：版本号 0.3.1；新增 `BASELINE-v0.3.1.json` 与完整 `SHA256SUMS.txt`；v0.2 来源记录保留（`BASELINE.json`、`V0.2-IDENTITY.md`）。

## 修改文件（相对 v0.3）

| 文件 | SHA-256 | 说明 |
| --- | --- | --- |
| `app/layout.tsx` | `193c8ddc69389f7937685fbabf556c467a2379994ba5d3ae8d758db73f86e3fa` | 横幅/元信息/版本标识 |
| `app/page.tsx` | `8093b2b66aa6aa7f5c35d66846b3224651e8dde73b18e5e46928f41ccc46bc22` | 客户页范围文案与步骤 |
| `app/staff/page.tsx` | `03219b9cbe2ae494c2324f8953643ef244cdc3a0bfb610c72b297e98c3949325` | 员工页范围文案 |
| `app/staff/staff-console.tsx` | `a53a7576f5754f6cdf767f87ea737859ffc9467bed75182a2162e15dbc67fa84` | 追踪失败反馈 |
| `scripts/browser-smoke.mjs` | `f97f5f18d40ba67d9cecb45313480241c7b202d705ebdeeefd97116f6fa44eaf` | 新增追踪失败回归 |
| `README.md` | `bccea0e3a51750d512936e3dd9ef5c05d843e6bdbdedec4bec3393155a55649d` | 版本、范围、日志位置、Node 25 说明 |
| `CHANGELOG.md` | `3781faf18e4c0d34d1c0a2daeebcbe22c682058eeb41184878e13e7f167045b8` | v0.3.1 条目 |
| `docs/handoff/FOUNDATION.md` | `16f69d87be5c4706dac1ba6a274b447d45ccf9f461f33e83e6c7886429a72817` | 状态与范围同步 |
| `package.json` | `33cbbcc8a2d20a85e1ac65e1e15c52ae3c6c7424211bb608e56cc2417b524e13` | 版本 0.3.1 |

## 新增文件

| 文件 | 说明 |
| --- | --- |
| `docs/verification-v0.3.1.md` | 本轮实际验证记录 |
| `docs/handoff/REVISION-v0.3.1.md` | 本文件 |
| `docs/verification-logs/v0.3.1/*.log` | 本轮实际日志（7 份） |
| `docs/evidence/01–11*.png`、`browser-results.json`、`home-preview.html` | 本轮浏览器证据 |
| `docs/evidence-history/v0.2-v0.3/` | 历史证据归档（原 `docs/evidence/`） |
| `V0.2-IDENTITY.md` | v0.2 来源标识（随包保留） |
| `BASELINE-v0.3.1.json` | 当前版本标识与完整源码摘要 |
| `SHA256SUMS.txt` | 完整 SHA 清单（最后生成） |

## 明确未改

`prisma/schema.prisma`、`prisma/migrations/*`、`prisma/seed.ts`、`lib/create-order.ts`、`lib/order-api.ts`、`lib/shipment-api.ts`、`types/orders.ts`、`app/api/**`、`next.config.ts`、`tsconfig.json`、依赖与 Prisma 版本（6.19.3）。

## 实际验证

- typecheck 0 / unit 9/9 / integration 39/39 / lint 0 / build 0 / browser 16/16（consoleErrors 0）。
- 详见 `docs/verification-v0.3.1.md` 与 `docs/verification-logs/v0.3.1/`。

## 包摘要

ZIP 的完整 SHA-256 由打包步骤另行计算并记录在交付说明中（本文件位于包内，无法包含自身 ZIP 摘要）。
