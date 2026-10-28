# 当前需求追踪 · v0.3.1 / repo-closure-1

编号与优先级继承 repo-init/docs/traceability.md（已保留原文参考）；以下是实现覆盖，不删减原需求。

| ID | 原需求/优先级 | 当前实现与证据 | 状态/缺口 |
|---|---|---|---|
| FR-01 | 订单创建，Must | POST /api/v1/orders；金额快照；tests/foundation.integration.ts；浏览器创建 | 核心已实现 |
| FR-02 | 状态流转，Must | 确认/拣货/发货/模拟揽收签收；orders与logistics-chain集成 | 部分：取消与库存释放未实现 |
| FR-03 | 单号与追踪，Must | ORD/LG、GET内部id的tracking；物流集成、浏览器时间线 | 核心已实现，客户自助入口未实现 |
| FR-04 | 库存管理及低库存预警，Must | 确认条件扣可用库存与ORDER_CONFIRM；事务集成 | 部分：独立预警/补货API与页面未实现；商品低库存数字提示不算模块完成 |
| FR-05 | 模拟状态通知，Should | 无当前通知端点 | 未实现 |
| FR-06 | 运营报表，Should | 无当前报表端点 | 未实现 |
| FR-07 | 用户/角色/鉴权，Must支撑 | User演示角色，修改接口401/403测试 | 部分：非真实认证，无查询所有权 |
| NFR-01 | 核心查询≤2s，列表首屏≤3s，Must | 无正式基准报告 | 待验证，不凭build通过判满足 |
| NFR-02 | 每日08:00–24:00教学时段可用，Must | 无长期运行记录 | 待验证 |
| NFR-03 | 最小权限，越权403，Must | 演示修改角色拒绝已测 | 部分：真实身份与对象授权未实现；缺身份401与越权403分开 |
| NFR-04 | 三类角色核心操作≤3步，Should | 历史走查清单保留 | 未完成实测，不能宣布通过 |
| NFR-05 | 代码规约/契约/CI全绿，Must | typecheck/lint/契约；仓库根CI已配置 | CI实际结果另查；配置文件存在不等于全绿 |

接口完整路径与错误码见 contracts/api.md。完整测试对应见 closure/verification-matrix.md。集成39包含3个顶层测试，不能当作39项需求覆盖。
