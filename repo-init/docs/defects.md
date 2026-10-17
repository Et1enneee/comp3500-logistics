# 缺陷日志 · Defect Log


> QA 双将（Chung / Li）双签维护。发现即记，不许攒。每条挂关联需求 ID。


| Def-ID | 严重度 | 关联 FR | 复现步骤 | 期望 vs 实际 | 状态 | 发现者 | 修复者 | 日期 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DEF-001 | S3 | FR-02 | （示例）CREATED 单直接改 DELIVERED | 期望 409，实际 200 | Verified | Li | Yin | 10-16 |
| TC-FR01-01 | — | FR-01 | SKU001 × 2（浏览器/API） | 预期 201、ORD- 单号、金额 300；实际符合 | PASS | Chung Ngon Man | | 2026-10-17 |
| TC-FR01-02 | S3 | FR-01 | SKU999 × 1（API） | 预期 400 SKU_NOT_FOUND；实际 400 SKU_NOT_FOUND_SKU999 | FAIL | Chung Ngon Man | | 2026-10-17 |
| TC-FR01-03 | S3 | FR-01 | SKU007 下 10 件，库存 4（浏览器/API） | 预期 400 INSUFFICIENT_STOCK；实际 400 INSUFFICIENT_STOCK_SKU007 | FAIL | Chung Ngon Man | | 2026-10-17 |
| TC-FR02-01 | — | FR-02 | 测试 7 个合法状态转移（单测） | 预期全部 true；实际 7 项通过 | PASS | Chung Ngon Man | | 2026-10-17 |
| TC-FR02-02 | S2 | FR-02 | CREATED → DELIVERED（单测/API） | 预期单测 false、接口 409；实际 false、404 | FAIL | Chung Ngon Man | | 2026-10-17 |
| TC-FR02-03 | S2 | FR-02 | CREATED → CONFIRMED（API） | 预期 200、负数库存流水；实际 404、无流水 | FAIL | Chung Ngon Man | | 2026-10-17 |
| TC-FR03-01 | S2 | FR-03 | 生成运单号 | 预期 LG-YYYYMMDD-XXXXXX；前置流程受阻，运单接口 404，格式未验证 | BLOCKED | Chung Ngon Man | | 2026-10-17 |
| TC-FR04-01 | S2 | FR-04 | 查库存预警（API，SKU007 库存 4、阈值 5） | 预期含 SKU007；实际接口 404 | FAIL | Chung Ngon Man | | 2026-10-17 |


- 严重度：S1 阻断主链路 / S2 功能不可用 / S3 边界异常 / S4 文案样式。
- 状态：Open → Fixing → Fixed → Verified → Closed。
- 修复后的用例号写入测试计划对应行（可追溯）。

本轮使用本机测试副本（已补齐 Prisma 关联）。PASS / FAIL 为实测结果；BLOCKED 表示前置功能受阻，待补测。DEF-001 为原模板示例。
