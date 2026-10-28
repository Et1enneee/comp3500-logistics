# v0.3 实际验证记录

记录时间：2026-10-28（本机）。仅记录实际执行并通过的结果；原始输出在 `foundation-v0.3-work/logs/`（工作区，不在本包内）。

## 环境

- Node v25.4.0 / npm 11.8.0（v0.2 注明用 Node 24 测试，本机 25 仍全部通过；vitest 对 Node 25 有 EBADENGINE 警告，不影响运行）
- Prisma 6.19.3（未升级）、Next 16.4.3、SQLite
- 工作副本：从原始 ZIP 全新解压，`SHA256SUMS.txt` 68/68 校验通过后修改

## 检查命令与结果

| 命令 | 结果 |
| --- | --- |
| `npm ci` | 成功（427 包） |
| `npm run db:setup` | 迁移 `20261013114356_init` 应用成功（全新库） |
| seed | 先确认新库全表 0 行，再 `RESET_DEMO_DATA=YES npm run db:seed:demo`；3 用户 / 10 商品 |
| `npm run typecheck` | exit 0 |
| `npm test`（单元） | 9/9 通过 |
| `npm run test:integration` | **39/39 通过**（原 28 + 新增 11） |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0；路由含 `/api/v1/shipments`、`/api/v1/orders/[id]/tracking` |
| 浏览器验收（全新 seed 库） | **15/15 PASS**（原 12 项零回归 + 新增 3 项主链） |

## 新增集成测试覆盖（tests/logistics-chain.integration.ts）

1. CONFIRMED→PICKING 合法；库存与流水不变（仍 1 条 ORDER_CONFIRM）。
2. CREATED 直接 PICKING → 409，无变更。
3. PICKING→SHIPPED 合法：LG- 运单号格式、初始事件（仓库）、库存不变、流水仍 1 条。
4. CONFIRMED 直接发货 → 409；无运单/事件残留。
5. 顺序重复发货 → 409 `SHIPMENT_EXISTS`，仍 1 张运单。
6. 并发重复发货 → 仅 1 张运单、1 条初始事件。
7. 未提供身份 → 401；CUSTOMER/ADMIN → 403；订单与运单不变（状态、updatedAt 不变）。
8. SHIPPED→IN_TRANSIT→DELIVERED：运单状态、deliveredAt、3 条事件按时间正序、库存不变。
9. 追踪：关联正确、事件顺序正确；错误 id → 404 且不泄露单号/运单号；未发货 → 404 `SHIPMENT_NOT_FOUND`。
10. PATCH `to=SHIPPED` / `to=CANCELLED` → 400 `INVALID_ARGUMENT`，无变更。

## 浏览器新增断言（scripts/browser-smoke.mjs）

- 确认→拣货→发货链路：一次 LG- 运单；发货前后库存相等。
- 重复发货 HTTP 409，仍 1 张运单。
- 揽收/签收后追踪 3 条事件，地点顺序 `仓库 → 揽收网点 → 收件地址`。

## 未验证 / 已知限制

见 `docs/known-issues.md` 第 10–13 条（追踪无鉴权、承运商自由文本、取消/通知未实现、运单号序号上限）。未做负载、长稳、真实用户验收与完整浏览器矩阵。
