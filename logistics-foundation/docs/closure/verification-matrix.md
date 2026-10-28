# 验证与覆盖对应表

数字口径：单测9/9；集成39/39（包含3个顶层测试，36个子场景，不称39个独立业务需求）；浏览器16/16。类型检查、lint、生产构建通过。它们不是需求覆盖率100%的证明。

| 能力/规则 | 实现入口 | 对应证据 | 结论 |
|---|---|---|---|
| 创建、单价快照、服务端金额、创建不占库存 | app/api/v1/orders/route.ts；lib/create-order.ts | tests/foundation.integration.ts；浏览器创建及库存检查 | 已覆盖 |
| 重复SKU汇总、无效数量、创建时缺货拒绝 | lib/create-order.ts | foundation.integration：duplicate SKUs、malformed lines、stock precheck | 已覆盖 |
| 按ORD查询、去除passwordHash | lib/order-api.ts | tests/orders.integration.ts；浏览器查询 | 已覆盖 |
| 确认事务、条件扣库存、ORDER_CONFIRM、重复确认409 | lib/order-api.ts | orders.integration；foundation end-to-end；浏览器确认/重复请求 | 已覆盖 |
| 创建后库存被其他订单占用，确认失败不变更 | lib/order-api.ts | foundation.integration：stock changed after creation | 已覆盖 |
| 拣货仅改变状态 | lib/order-api.ts | logistics-chain.integration：CONFIRMED→PICKING、非法PICKING | 已覆盖 |
| 发货唯一运单、无二次扣库存、失败无残留 | lib/shipment-api.ts | logistics-chain.integration：合法/非法、顺序/并发重复发货；浏览器 | 已覆盖 |
| 揽收/签收与运单/事件关联 | lib/order-api.ts；lib/shipment-api.ts | logistics-chain.integration：DELIVERED、tracking association | 已覆盖；承运商更新为模拟 |
| 演示身份401/403，ADMIN不继承STAFF | 修改路由后端检查 | orders/logistics-chain integration；浏览器客户越权 | 已覆盖演示权限，非真实认证 |
| 追踪500/网络失败不掩盖订单、不误报已成功修改 | app/staff/staff-console.tsx | scripts/browser-smoke.mjs：v0.3.1两项追踪异常断言 | 已覆盖 |
| 未实现CANCELLED、禁止PATCH直接SHIPPED | lib/order-api.ts | logistics-chain.integration：unsupported target | 当前返回400；不等于已实现取消 |
| 客户所有权、真实认证、取消释放、通知/预警模块 | 无对应当前完整实现 | 无 | 未实现，不记通过 |
| 性能、长期可用性、完整可用性/NFR-05 | 无正式报告 | 无 | 未验证 |

## 证据位置和归属
- 当前包内日志：docs/verification-logs/v0.3.1/；当前截图：docs/evidence/。
- 历史记录：docs/evidence-history/；历史响应get-order.example.json只说明当时数据，不应用于新库硬编码。
- 助手独立运行验收：对前一v0.3.1包在隔离环境执行上述全套检查通过；最终候选封包仅改锁文件版本、交接说明和摘要，业务文件及依赖树相同。此次文档收口也没有重新运行全套测试，不将历史日志冒称本轮新结果。
- 尹培旭：已对冻结v0.3.1源码复核，确认原事务、标识、无重复扣库存和schema不变；未运行本轮类型检查/测试/构建，原因是依赖下载网络阻塞。这是源码复核签收，不是他独立复现实测。
- 本文不推定杨庭彰或其他成员已经签收，也不转移其未完成工作的归属。

## 接手时的复现要求
接收者在全新目录和可丢弃库执行README步骤及五项检查、浏览器验收，记录实际环境/命令/退出码/统计。失败保留原日志；不得删用例、放宽断言或用旧日志替换。测试通过后，另记包SHA与仓库commit（若存在）；无Git元数据不能补造commit。
