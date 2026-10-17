# 缺陷日志 · Defect Log


> QA 双将（Chung / Li）双签维护。发现即记，不许攒。每条挂关联需求 ID。


| Def-ID | 严重度 | 关联 FR | 复现步骤 | 期望 vs 实际 | 状态 | 发现者 | 修复者 | 日期 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DEF-001 | S3 | FR-02 | （示例）CREATED 单直接改 DELIVERED | 期望 409，实际 200 | Verified | Li | Yin | 10-16 |


- 严重度：S1 阻断主链路 / S2 功能不可用 / S3 边界异常 / S4 文案样式。
- 状态：Open → Fixing → Fixed → Verified → Closed。
- 修复后的用例号写入测试计划对应行（可追溯）。

## 2026-10-17 卡-05 测试执行记录

记录负责人：Chung Ngon Man（GitHub：Jaden-Gittt）。执行方式：本人浏览器操作及 Codex 协助复测。

### 环境与判定口径

- 测试日期：2026-10-17（香港时间）；测试站点：`http://localhost:3000`。
- 业务代码来源：提交 e117d4039d03a3fd7645c76dcf3ebbbf3c3ebff1 的 repo-init；用例以本 PR 的 test-plan.md 卡-05 八行表为准。
- 本机环境：Windows、Node.js 24.19.0、Next.js 16.4.2、Prisma 6.19.3、Vitest 5.0.5、SQLite；使用 prisma/seed.ts 的演示账号和商品。
- 启动修正：本机测试副本 Product 补上 orderItems OrderItem[] 与 inventoryLogs InventoryLog[] 反向关联；建立 Next.js 骨架并配置测试/seed 指令。共享仓库业务代码没有在本次测试中修复。结果适用于这份已说明修正的本机副本。
- 浏览器实测覆盖正常下单及库存不足；其余通过 HTTP API 补充测试及现有单元测试执行，未把 API/单元测试称为浏览器点击测试。
- PASS 表示该项预期已核实；FAIL 表示实际结果与表内预期不符；BLOCKED 表示前置条件无法满足。错误码按原表完整字符串比对，SKU 后缀差异暂记 FAIL，待组长确认契约后复测。
- 上方 DEF-001 是原始模板的示例，不计入本轮实测，也不代表本轮验证了“实际 200”。

### 八条用例结果

| 日期 | 用例编号 | 操作及测试数据 | 预期结果 | 实际结果 | 结论 | 测试者 | 证据/关联 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-17 | TC-FR01-01 | 客户 customer@demo.com 下 SKU001 × 2；浏览器操作并通过 POST /api/v1/orders 复测 | 201；ORD- 单号；totalCents=300 | 浏览器订单 ORD-20261017-0001；API 复测 201，ORD-20261017-0004，status=CREATED，totalCents=300，quantity=2，unitPriceCents=150 | PASS | Chung Ngon Man（Codex 协助） | 下方 E-01；浏览器标头/回传截图已在测试机留存 |
| 2026-10-17 | TC-FR01-02 | POST /api/v1/orders；items=[{sku:SKU999,quantity:1}] | 400 SKU_NOT_FOUND | HTTP 400；error.code=SKU_NOT_FOUND_SKU999；未知商品有被拒绝，但完整错误码不一致 | FAIL | Chung Ngon Man（Codex 协助） | E-02；QA-001 |
| 2026-10-17 | TC-FR01-03 | SKU001 数量设为 0，SKU007 下 10 件（库存 4）；浏览器操作及 API 复测 | 400 INSUFFICIENT_STOCK | HTTP 400；error.code=INSUFFICIENT_STOCK_SKU007；库存不足有被拒绝，但完整错误码不一致 | FAIL | Chung Ngon Man（Codex 协助） | E-03；QA-001 |
| 2026-10-17 | TC-FR02-01 | 执行 lib/constants.test.ts 中 7 个合法转移断言 | 7 个 canTransition 结果全为 true | 7 项全部 passed；整份单元测试共 9 passed、0 failed | PASS | Chung Ngon Man（Codex 协助） | E-04 |
| 2026-10-17 | TC-FR02-02 | 单测 CREATED→DELIVERED；另对已创建的真实订单 PATCH /api/v1/orders/{id}/status，to=DELIVERED | 单测 false；接口 409 | 单测确认 false（PASS）；API 实际 404 text/html，未达到预期 409；订单仍为 CREATED | FAIL（API；单测 PASS） | Chung Ngon Man（Codex 协助） | E-04、E-05；QA-002 |
| 2026-10-17 | TC-FR02-03 | 对同一真实 CREATED 订单 PATCH /api/v1/orders/{id}/status，to=CONFIRMED；检查该订单库存流水 | 200；新增负数库存流水 | HTTP 404 text/html；订单仍为 CREATED，该订单 InventoryLog 为 []，未发生预占 | FAIL | Chung Ngon Man（Codex 协助） | E-05、E-08；QA-002 |
| 2026-10-17 | TC-FR03-01 | 检查发货前置流程及 POST /api/v1/shipments 端点可用性 | 在符合发货前置条件的订单生成 LG-YYYYMMDD-XXXXXX 运单号 | 状态更新端点缺失，无法通过正常流程准备 PICKING 订单；运单端点探测也回传 404，尚未验证运单号格式 | BLOCKED | Chung Ngon Man（Codex 协助） | E-06；QA-003；端点探测不算格式测试通过 |
| 2026-10-17 | TC-FR04-01 | 确认 SKU007 stock=4、lowStockThreshold=5；GET /api/v1/alerts | 200；预警包含 SKU007 | 种子条件成立；GET /alerts 实际 404 text/html，没有预警列表可核对 | FAIL | Chung Ngon Man（Codex 协助） | E-07、E-08；QA-004 |

汇总：八条用例均有结果记录；2 PASS、5 FAIL（其中一条单测 PASS、API FAIL）、1 BLOCKED。BLOCKED 不计为完整执行通过；其余七条包含实际执行记录，达到至少六行实测记录。九个单元断言全部通过不代表八条业务用例全部通过。

### 关键执行证据

原始 API 请求/回传和单元测试 JSON 已保存在本轮测试机 evidence/qa-results.json、evidence/unit-tests.json；以下摘录足以核对本表。截图证据不替代接口或单元断言。

- E-01：POST /api/v1/orders，JSON 为 {"email":"customer@demo.com","items":[{"sku":"SKU001","quantity":2}]}；201，orderNumber=ORD-20261017-0004，id=cmvc89yfd000d333ctndrinja，totalCents=300。
- E-02：同端点，SKU999 × 1；400，{"error":{"code":"SKU_NOT_FOUND_SKU999","message":"SKU_NOT_FOUND_SKU999"}}。
- E-03：同端点，SKU007 × 10；400，{"error":{"code":"INSUFFICIENT_STOCK_SKU007","message":"INSUFFICIENT_STOCK_SKU007"}}。
- E-04：Vitest：9 passed / 0 failed。合法转移分别为 CREATED→CONFIRMED、CREATED→CANCELLED、CONFIRMED→PICKING、CONFIRMED→CANCELLED、PICKING→SHIPPED、SHIPPED→IN_TRANSIT、IN_TRANSIT→DELIVERED。另两项是 CREATED→DELIVERED 返回 false，以及 CANCELLED→CONFIRMED 返回 false。
- E-05：PATCH /api/v1/orders/cmvc89yfd000d333ctndrinja/status；分别发送 {"to":"DELIVERED"}、{"to":"CONFIRMED"}，均为 404，Content-Type 为 text/html; charset=utf-8。
- E-06：POST /api/v1/shipments，{"orderId":"cmvc89yfd000d333ctndrinja","carrier":"QA demo"}，404 text/html。此探测使用 CREATED 订单，仅验证端点是否存在，未将其当作合法发货流程。
- E-07：GET /api/v1/alerts，404 text/html。
- E-08：Prisma 只读复核：SKU007 为 stock=4、lowStockThreshold=5；订单 ORD-20261017-0004 仍为 CREATED；其 InventoryLog 为 []。

### 本轮缺陷及阻塞

| Def-ID | 严重度 | 关联 FR / 用例 | 复现步骤 | 期望 vs 实际 | 状态 | 发现者 | 修复者 | 日期 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| QA-001 | S3 | FR-01 / TC-FR01-02、03 | 分别下 SKU999 × 1 和 SKU007 × 10 | 两项均正确拒绝请求，但错误码增加 SKU 后缀，与卡-05 原表不同；需统一契约或实现后复测 | Open | Chung Ngon Man（Codex 协助） | 待指派 | 2026-10-17 |
| QA-002 | S2 | FR-02 / TC-FR02-02、03 | 对真实订单调用状态更新端点 | 预期非法转移 409、合法确认 200 并记负数流水；实际均 404，流程无法执行 | Open | Chung Ngon Man（Codex 协助） | 待指派 | 2026-10-17 |
| QA-003 | S2 | FR-03 / TC-FR03-01 | 准备 PICKING 订单并生成运单 | 前置状态流程无法完成，运单端点 404；运单号格式测试被阻塞 | Open | Chung Ngon Man（Codex 协助） | 待指派 | 2026-10-17 |
| QA-004 | S2 | FR-04 / TC-FR04-01 | 使用 stock=4、阈值=5 的 SKU007 查预警 | 预期列表包含 SKU007；实际端点 404 | Open | Chung Ngon Man（Codex 协助） | 待指派 | 2026-10-17 |
| QA-005 | S4 | FR-01 / 本机界面走查 | 在本机深色主题下提交成功或失败订单 | 提示应清晰可读；实际浅色文字配浅色背景，难以辨认；需在团队最终页面样式下复核 | Open | Chung Ngon Man（Codex 协助） | 待指派 | 2026-10-17 |
| QA-006 | S2 | FR-01、FR-04 / 启动环境 | 用仓库 schema 初始化 Prisma | Product 缺少 OrderItem、InventoryLog 反向关联；本机补齐后 validate/migrate 成功，仓库原文件仍待开发者修复 | Open（本机已临时补齐） | Chung Ngon Man（Codex 协助） | 待指派 | 2026-10-17 |
