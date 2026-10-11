# Must 功能验收场景 · Acceptance Scenarios (v0)

> Owner：Li Mu Qiu（Chung 双签）。每条 Must FR 必须写完 GWT，条条可测＝满分升格。
> 格式：Given / When / Then；每条挂 FR-ID，编号 TC-FRxx-01…，回填追踪矩阵。

## FR-01 订单创建（范例，其余同此口径）

- **Given** 客户 CUST-1 已登录；库存：SKU-A 有 8 件、单价 ￥12.50
- **When** 客户下单选 SKU-A × 2 并提交
- **Then** 返回订单号 ORD-…；状态 CREATED；totalCents = 2500；页面显示「已创建」且明细与合计正确

## FR-02 状态流转

- **Given** … **When** … **Then** …（合法转移逐条；非法转移须显式断言 409）

## FR-03 单号追踪

- **Given** … **When** … **Then** …（发货生成运单号唯一；IN_TRANSIT 后新增 TrackingEvent；客户页可见事件正序）

## FR-04 库存与预警

- **Given** … **When** … **Then** …（确认订单预占库存；发货扣减；stock < lowStockThreshold 时 /alerts 出现该 SKU；InventoryLog 无一条可删）

## FR-05 通知（Should）

- **Given** … **When** … **Then** …（状态变化后站内通知出现且未读可标已读）
