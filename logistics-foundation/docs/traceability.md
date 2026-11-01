# 需求追踪 · v0.4.0

编号沿用原需求文档；下表只反映当前实现与可核验证据。测试计数与原始日志见交付包 `evidence/`。

| ID | 原需求/优先级 | 当前实现 | 主要证据 | 状态 |
|---|---|---|---|---|
| FR-01 | 订单创建，Must | `POST /api/v1/orders`，会话取 customerId，库存预检不扣减，价格快照 | `tests/foundation.integration.ts`；浏览器 01–02 | 已实现 |
| FR-02 | 状态流转与取消，Must | 确认/拣货/发货/揽收/签收 + 取消（CREATED 不回补 / CONFIRMED 回补一次）；PICKING 后拒绝 | `tests/orders.integration.ts`、`tests/logistics-chain.integration.ts`、`tests/cancel.integration.ts` | 已实现 |
| FR-03 | 单号与追踪，Must | ORD/LG 唯一编号；客户自助订单中心与时间线；跨客户 404 | `tests/logistics-chain.integration.ts`；浏览器 03–04、09 | 已实现 |
| FR-04 | 库存与低库存预警，Must | 可用库存语义；确认负流水、取消正释放、补货正流水；严格 `stock<threshold`；独立预警区与流水页 | `tests/inventory.integration.ts`、`tests/cancel.integration.ts`；浏览器 16–18 | 已实现 |
| FR-05 | 站内通知，Should | 五类业务事件在事务内生成；(orderId,type) 唯一；未读数/标记已读 | `tests/notifications.integration.ts`；浏览器 10 | 已实现 |
| FR-06 | 运营报表，Should | ADMIN 只读聚合、GMT+8 日期范围、CSV 导出 | `tests/reports.integration.ts`；浏览器 11 | 已实现 |
| FR-07 | 用户/角色/鉴权，Must | scrypt 密码、Session + HttpOnly Cookie、CSRF、限流、401/403/404 边界 | `tests/auth.integration.ts`；`lib/auth.ts`、`lib/http.ts` | 已实现 |
| NFR-01 | 核心查询 ≤2s、列表首屏 ≤3s，Must | 生产构建、30 次 API 采样、3 次界面采样 | `evidence/performance.json` | 本机达标，非公网/高并发 |
| NFR-02 | 每日 08:00–24:00 可用，Must | 未做长期运行 | — | 未验证（不以短测代替） |
| NFR-03 | 最小权限，Must | 角色矩阵 + 对象级 404；测试固定该决策 | `tests/auth.integration.ts`、`tests/orders.integration.ts` | 已实现 |
| NFR-04 | 核心操作 ≤3 步，Should | 客户下单、员工确认/发货等窗口内动作 ≤3 次主要操作；未做正式计时走查 | 浏览器脚本步骤 | 部分（未正式验收） |
| NFR-05 | 代码规约/契约/CI，Must | typecheck/lint/unit/integration/build/browser 全部可执行；根 CI 配置完整 | `evidence/test-logs/`、`.github/workflows/ci.yml` | 本地全绿；远端 CI 以实际上传后运行为准 |

接口与错误码见 `contracts/api.md`；限制见 `known-issues.md`。
