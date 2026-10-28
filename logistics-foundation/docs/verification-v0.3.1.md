# v0.3.1 实际验证记录（封版修订）

记录时间：2026-10-28（本机）。仅记录实际执行并通过的结果；原始输出在 `docs/verification-logs/v0.3.1/`。

## 环境

- Node v25.4.0 / npm 11.8.0（vitest 对 Node 25 有 EBADENGINE 警告，不影响运行）
- Prisma 6.19.3（未升级）、Next 16.4.3、SQLite
- 从 v0.3 候选 ZIP（SHA-256 `c0d76987c75469661272754a43365b1c57babb9e4a162182dae016b0e91412f1`）全新解压；未改 schema、未升级依赖

## 检查与结果

| 命令 | 结果 |
| --- | --- |
| `npm ci` | 成功（版本 0.3.1，锁文件无冲突） |
| `npm run db:setup` | 迁移应用成功（全新库） |
| seed | 先确认新库 `users=0 / orders=0`，再 `RESET_DEMO_DATA=YES`；3 用户 / 10 商品 |
| `npm run typecheck` | exit 0 |
| `npm test`（单元） | 9/9 |
| `npm run test:integration` | 39/39（原 28 + v0.3 新增 11） |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0；路由 7 条（含 shipments / tracking） |
| 浏览器验收（全新 seed 库） | **16/16 PASS**，`consoleErrors` 为空 |

## 本轮新增浏览器回归（追踪读取失败）

1. 无运单（CREATED）查询：**不显示**追踪警告。
2. 状态更新成功、追踪返回 500：状态仍为 IN_TRANSIT，显示“运单追踪读取失败”，无“操作失败/结果未知”错误提示，下一步“模拟签收”可用（不诱导重复操作）。
3. 追踪网络中断时重新查询：订单详情正常显示，显示“网络错误”追踪警告，无非空错误提示。
4. 签收后追踪恢复：3 条事件，地点顺序 `仓库 → 揽收网点 → 收件地址`。

## 证据与日志

- 本轮截图：`docs/evidence/01–11*.png`；结果 JSON：`docs/evidence/browser-results.json`
- 历史证据：`docs/evidence-history/v0.2-v0.3/`
- 本轮日志：`docs/verification-logs/v0.3.1/`（typecheck / unit / integration / lint / build / browser / server）

## 已知限制

见 `docs/known-issues.md` 第 10–13 条（追踪无鉴权、承运商自由文本、取消/通知未实现、运单号序列上限）。
