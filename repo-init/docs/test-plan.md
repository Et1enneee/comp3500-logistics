# 测试计划 · Test Plan (v0 skeleton)

> Owner：Chung Ngon Man。五层映射如下，用例命名 `TC-<FR/NFR>-<层>-<序号>`，文件 `__tests__/*.test.ts`。

| 层 | 测什么 | 对应 Must | 实现/执行 |
| --- | --- | --- | --- |
| Unit 单元 | 状态机转移、输入校验、金额计算 | FR-02, FR-01 | Yin 实现，QA 拟用例 |
| Component 组件 | 页面组件渲染与交互 | FR-01/03 页面 | Tang 实现，QA 拟用例 |
| Integration 集成 | API ↔ DB 链路（含事务与回滚） | FR-01/02/04 | Yin/Tang 实现，QA 执行 |
| System 系统 | Must 主链路端到端脚本 | 全 Must | QA 双人执行 |
| Acceptance 验收 | 每条 Must FR 的 GWT 场景＋性能 NFR | 全 Must | Li 主笔，按 docs/acceptance.md |
| Performance 性能 | 对照 NFR-01（≤2s） | NFR-01 | QA 执行留录屏 |

- 缺陷一律进 `docs/defects.md`；修复后测试用例编号回填本计划与追踪矩阵。
- 测试数据一律来自 `prisma/seed.ts` 固定种子，保证结果可复现（演示证据）。

| 用例 | 测什么 | 预期 |
| --- | --- | --- |
| TC-FR01-01 | 客户下 SKU001×2 | 201，ORD- 单号，totalCents=300 |
| TC-FR01-02 | items 含不存在的 SKU999 | 400 SKU_NOT_FOUND |
| TC-FR01-03 | SKU007 下 10 件（库存只 4） | 400 INSUFFICIENT_STOCK |
| TC-FR02-01 | 状态机 7 个合法转移 | 单测全 true |
| TC-FR02-02 | CREATED 直接改 DELIVERED | 单测 false / 接口 409 |
| TC-FR02-03 | CREATED→CONFIRMED | 200；库存流水多一条负数（预占） |
| TC-FR03-01 | 生成运单号 | 格式 LG-YYYYMMDD-XXXXXX |
| TC-FR04-01 | 查库存预警 | 含 SKU007（库存 4 低于阈值 5） |
