> 原始编号与阈值来源；旧端点/占位测试编号不代表当前实现。当前状态见../../traceability.md。

# 需求编号与追踪矩阵 · Traceability (v0)

> 工作编号以 Sprint 0 SRS 定稿为准；SRS 每条带 FR/NFR ID + 验证方法 + MoSCoW 优先级。
> 军法：每个 PR 描述写关联 ID；每个测试文件头注释写其 FR-ID；本矩阵由 QA 双将维护，任何新建行随对应 PR 同步。

## 工作编号与验证方法

| ID | 需求 | MoSCoW | 验证方法 |
| --- | --- | --- | --- |
| FR-01 | 订单创建（含明细与合计） | Must | 测试 + 演示 |
| FR-02 | 订单状态流转（状态机） | Must | 单元/集成测试 |
| FR-03 | 单号生成与运单追踪 | Must | 测试 + 演示 |
| FR-04 | 库存管理与低库存预警 | Must | 测试 + 演示 |
| FR-05 | 状态通知（模拟） | Should | 演示 |
| FR-06 | 运营报表 | Should | 演示 |
| FR-07 | 用户、角色与鉴权 | Must（支撑） | 审查 + 演示 |
| NFR-01 | 性能：核心查询响应 ≤ 2s，列表首屏 ≤ 3s | Must | 测试 |
| NFR-02 | 可用性：教学时段（每日 08:00–24:00）可连续使用 | Must | 演示 + 审查 |
| NFR-03 | 安全：角色权限最小化，越权一律 403 | Must | 测试 + 审查 |
| NFR-04 | 易用性：三类角色核心操作 ≤ 3 步完成 | Should | 可用性走查 |
| NFR-05 | 可维护性：代码规约、契约文档、CI 全绿 | Must | 审查 |

## 矩阵方向

| 需求 ID | 设计元素（UML 类/组件） | API 端点 | 测试用例 ID（待填） |
| --- | --- | --- | --- |
| FR-01 | OrderService, OrderCreateForm | POST /orders | TC-FR01-xx |
| FR-02 | OrderStateMachine | PATCH /orders/{id}/status | TC-FR02-xx |
| FR-03 | ShipmentService, TrackingPage | POST /shipments; GET /orders/{id}/tracking | TC-FR03-xx |
| FR-04 | InventoryService, StockPage | GET /products; POST /products/{id}/stock; GET /alerts | TC-FR04-xx |
| FR-05 | NotificationService | /notifications | TC-FR05-xx |
| FR-06 | ReportingService | /reports/orders | TC-FR06-xx |
| FR-07 | Auth, RBAC | （全局） | TC-FR07-xx |
| NFR-01 | — | （全端点） | TC-NFR01-xx |
| NFR-02 | Deployment 配置 | — | TC-NFR02-xx |
| NFR-03 | RBAC 中间件 | （全局 403） | TC-NFR03-xx |
| NFR-04 | UI 流程 | — | 走查清单 |
| NFR-05 | CI + docs | — | 审查 |
