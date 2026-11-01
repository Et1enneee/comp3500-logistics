# Group 42 · 物流管理应用 v0.4.2

`logistics-foundation/` 是本仓库唯一应用：在已验收 v0.3.1 底座上补齐真实登录与授权、客户订单中心、员工履约工作台、取消与库存释放、库存/预警/流水、站内通知、ADMIN 只读报表与 CSV 导出。

本地教学演示，**不用于生产环境**：物流是本地模拟（页面已标注），未接入真实承运商或支付。

## 本包能做什么

- `/login`：真实会话登录（scrypt 密码哈希、HttpOnly Cookie、CSRF、登录限流）。旧 `X-Demo-User-Email` 不再有任何认证或授权效力。
- `/`（客户）：数据库商品目录、整数数量、实时预估合计、下单；`/orders` 我的订单（状态筛选、分页、按 ORD 查询）；`/orders/{id}` 明细、运单时间线、取消；`/notifications` 通知中心（未读数、标记已读）。
- `/staff`（员工）：订单队列（状态筛选、分页、按 ORD 精确查询）；`/staff/orders/{id}` 确认 / 拣货 / 发货（唯一 LG 运单）/ 模拟揽收 / 模拟签收 / 取消 CONFIRMED；`/inventory` 库存、低库存预警、补货、库存流水。
- `/admin`（管理员，只读）：订单数、状态分布、已签收金额、非取消金额、当前低库存 SKU、GMT+8 日期范围、CSV 导出；库存页只读。
- API：`/api/v1/auth/*`、`/api/v1/orders`（创建/列表/按 ORD 查询）、`/api/v1/orders/{id}`、`/api/v1/orders/{id}/status`、`/api/v1/orders/{id}/tracking`、`/api/v1/shipments`、`/api/v1/inventory*`、`/api/v1/notifications*`、`/api/v1/reports/overview`、`/api/v1/reports/export.csv`。

## 1. 全新目录安装（Node 24，本轮验证 24.22.2）

```bash
npm ci
npm run db:setup      # prisma generate + migrate deploy（迁移保留既有数据）
```

**仅全新或可丢弃的演示库**重建演示数据（seed 有明确确认闸口，会清空该库）：

macOS / Linux：
```bash
RESET_DEMO_DATA=YES npm run db:seed:demo
```
Windows PowerShell：
```powershell
$env:RESET_DEMO_DATA="YES"
npm run db:seed:demo
Remove-Item Env:RESET_DEMO_DATA
```

seed 生成：2 客户 + 1 员工 + 1 管理员、10 个 SKU（SKU007 库存 4 / 阈值 5）、56 张覆盖各状态与两种取消路径的订单、真实运单/追踪事件/库存流水/站内通知，并打印演示账号。密码由 `DEMO_PASSWORD` 配置，默认 `Demo1234!`，以 scrypt 哈希入库。

启动：

```bash
npm run dev:local     # http://127.0.0.1:3000
# 或生产构建
npm run build && npm run start -- --hostname 127.0.0.1 --port 3100
```

> 若本机 shell 设置了 `RUST_LOG`，Prisma CLI 在数据库文件尚不存在时会报空的 `Schema engine error`（其日志解析把首行当 banner）。执行 Prisma 命令前 `unset RUST_LOG`，或先 `touch prisma/dev.db`。CI 默认不设置该变量。

## 2. 已实现的业务规则（便于代码追踪）

- 下单只校验可用库存，创建 `CREATED`；不扣库存、不写流水（`lib/create-order.ts`）。
- 确认是权威校验：同一事务内条件更新状态、按 SKU 汇总条件扣减、每 SKU 一条 `ORDER_CONFIRM` 负流水、写通知；失败整体回滚（`lib/order-api.ts`）。
- 取消：`CREATED → CANCELLED` 不动库存；`CONFIRMED → CANCELLED` 回补并写 `ORDER_CANCEL_RELEASE` 正流水，只释放一次；`PICKING` 及之后拒绝（409）。
- 发货：`PICKING → SHIPPED` 条件抢占，同一事务生成唯一 `LG-YYYYMMDD-XXXXXX` 运单、初始事件与通知；重复/并发只有一张运单（`lib/shipment-api.ts`）。
- 库存：`stock` 固定表示可用库存；补货只增量并写 `STOCK_REPLENISH` 流水与操作人；预警严格 `stock < threshold`（`lib/inventory-api.ts`）。
- 报表：按 `createdAt` 归属 GMT+8 自然日（起始含、结束日次日 00:00 不含），金额称“订单金额”；CSV 防公式注入（`lib/reports-api.ts`）。
- 查询参数：页面与 API 共用校验；非法状态、小数或重复页码返回可恢复提示/API 400。下单保留 `SKU_NOT_FOUND_<sku>` 和 `INSUFFICIENT_STOCK_<sku>` 错误码；畸形会话 Cookie 视为失效。
- 身份：`401` 未登录、`403` 角色不符/CSRF 失败、跨客户对象统一 `404`（`lib/http.ts`、`lib/order-api.ts`）。

## 3. 检查与证据

```bash
npm run typecheck
npm test
npm run test:integration
npm run test:delivery
npm run lint
npm run build
# 浏览器验收（先 build + start + 全新 seed）：
FOUNDATION_BROWSER_TEST=YES FOUNDATION_BASE_URL=http://127.0.0.1:3100 npm run test:browser
```

完整隔离证据（可从仓库根或应用目录运行）：

```bash
npm run baseline
RESET_DEMO_DATA=YES npm run evidence
```

调用者必须显式确认；脚本会复制源码到独立临时目录，安装锁定依赖、迁移并 seed 临时库、执行测试/构建/性能/浏览器/重启检查，结束后删除副本。**原项目数据库不参与此流程。** 默认输出 `../evidence/`，可用 `EVIDENCE_ROOT` 指定；未确认时在任何副作用之前退出。源码摘要与打包共用 `scripts/source-files.mjs`，排除数据库、真实环境变量、依赖、构建/编译缓存和运行证据；打包时重新核对摘要，不匹配即拒绝交付。

浏览器脚本输出 PNG 与 `browser-results.json`（默认 `docs/evidence/`，可用 `EVIDENCE_DIR` 指定）；不会在测试中伪造界面截图。

## 4. 目录

```
app/                页面与 App Router 路由（api/v1/* 为后端接口）
components/ui.tsx   状态徽章、分页、空状态等共享展示组件
lib/                业务函数（下单、状态、发货、库存、通知、报表、认证、HTTP、时间）
prisma/             schema、两份迁移、seed
tests/              真实 SQLite 集成测试（每个文件独立临时库）
scripts/            浏览器验收
docs/               合同、追溯、已知限制与历史证据
```

## 5. 已知限制

- SQLite 单写者模型：并发写冲突会返回 503，不承诺企业级吞吐。
- 报表库存指标是“当前快照”，不随订单日期过滤（界面已标明）。
- 2026-11-01 完整 audit 为 3 high + 16 moderate；`npm audit --omit=dev` 仍为 3 high。Prisma/deepmerge-ts 链仍在非 dev 安装范围，不能视为运行环境无风险；moderate 来自 ESLint/minimatch 链。原始 JSON、扫描口径及限制见 `docs/known-issues.md`；本次不强制破坏性升级。
- 未实现：公开注册、找回密码、OAuth/MFA、真实支付、真实承运商 API、邮件/短信/推送、多仓、退货退款。
