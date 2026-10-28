# 冻结基线 v0.3.1 · 数据口径

结构以 prisma/schema.prisma 为准。本次无 schema 迁移；沿用尹培旭修复后的反关系和现有初始迁移。

- Product.stock 在本候选实现中明确表示**可用库存**，而不是“含已预占的物理在库”。这是冻结实现对早期契约“账面在库”表述的语义收敛；本文件记录当前可运行行为。尹已源码复核确认无二次扣减；不推定所有团队旧文件已同步，也不推定杨已签收。完整需求覆盖见 ../closure/scope-and-srs-addendum.md。
- 创建：预检可用库存；不减少 stock，不写 InventoryLog。重复 SKU 汇总，单价快照、总金额均用整数分。
- 确认：CREATED → CONFIRMED；同一事务中 stock -= quantity，每种商品一条 delta=-quantity / reason=ORDER_CONFIRM / orderId 关联流水。
- 不新增 reserved 字段，也不声称建立了独立 Reservation 实体。
- 后续发货规则（v0.3 已接入）：PICKING → SHIPPED 走 POST /api/v1/shipments；同一事务内生成唯一运单号（LG-YYYYMMDD-XXXXXX）与初始 TrackingEvent；不再扣减已预占的 stock，也不写 InventoryLog。
- 后续取消规则：仍在本轮范围外；未来 CONFIRMED 取消释放一次已占数量，写对应正流水（reason 定名 ORDER_CANCEL_RELEASE），状态与回补原子完成。当前未实现取消接口。
- Order.orderNumber 是 ORD-YYYYMMDD-XXXX；Order.id 是内部主键。确认使用后者。
- GET 返回客户 id/name/email，不返回 passwordHash；目前尚无对象级查询鉴权，不能用真实客户信息。
- Shipment、TrackingEvent 已在 v0.3 接入运行功能（发货与追踪）；Notification 仍未实现。
- TrackingEvent 只增不改：发货时写「仓库」，模拟揽收写「揽收网点」，模拟签收写「收件地址」；追踪接口按时间正序返回。

演示数据注意：SKU008 当前 seed 是库存 50 / 阈值 10。历史验收稿的 6 / 5 是测试 fixture，不代表 seed 已改。本包不通过改 seed 冒充预警测试通过。
