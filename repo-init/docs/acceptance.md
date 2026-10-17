# Must 功能验收场景 · Acceptance Scenarios (v0)

> Owner：Li Mu Qiu（Chung 双签）。每条 Must FR 必须写完 GWT，条条可测＝满分升格。
> 格式：Given / When / Then；每条挂 FR-ID，编号 TC-FRxx-01…，回填追踪矩阵。


## FR-01 订单创建

- **Given** 客户 CUST-1 已登录；库存：SKU-A 有 8 件、单价 ￥12.50
- **When** 客户下单选 SKU-A × 2 并提交
- **Then** 返回订单号 ORD-…；状态 CREATED；totalCents = 2500；页面显示「已创建」且明细与合计正确
> FR-ID: FR-01
> TC-FR01-01

## FR-02 状态流转

- **Given** 订单当前状态为 CREATED
- **When** 请求将订单状态修改为 CONFIRMED（合法状态跳转）
- **Then** 状态更新为 CONFIRMED，操作执行成功，无错误返回；完成库存预占并生成库存流水记录
> FR-ID: FR-02
> TC-FR02-01

- **Given** 订单当前状态为 CREATED
- **When** 请求直接把订单状态修改为 DELIVERED（非法状态跳转）
- **Then** 系统执行断言校验，拒绝本次修改；返回409错误码；订单仍然保持 CREATED，状态不变
> FR-ID: FR-02
> TC-FR02-02

## FR-03 单号追踪

- **Given** 订单状态已经更新为 PICKING
- **When** 系统执行发货流程
- **Then** 生成唯一运单号；新增 TrackingEvent 追踪事件；客户页面可按顺序查看物流事件；订单状态变更为 SHIPPED
> FR-ID: FR-03
> TC-FR03-01

## FR-04 库存与预警

- **Given** SKU007 当前库存为 4，低库存阈值 lowStockThreshold 设置为 5
- **When** 系统执行库存预警校验 
- **Then** SKU007 满足低库存条件；系统生成 SKU007 低库存预警记录；查询 /alerts 可获取 SKU007 预警
> FR-ID: FR-04
> TC-FR04-01

- **Given** SKU008 现有库存 6 件，低库存阈值 lowStockThreshold 设置为 5，存在一条待确认、预占数量 = 2 的 CREATED 订单
- **When** 员工确认订单，预占 SKU008 数量 2
- **Then** SKU008 预占后剩余可用库存为 4（4 < 5）；触发低库存预警；查询 /alerts 包含 SKU008；生成 InventoryLog 库存预占记录，delta=-2
> FR‑ID: FR‑04
> TC‑FR04‑02

- **Given** SKU008 现有库存 6 件，低库存阈值 lowStockThreshold 设置为 5，存在一条待确认、预占数量 = 1 的 CREATED 订单
- **When** 员工确认订单，预占 SKU008 数量 1
- **Then** SKU008 预占后剩余可用库存为 5（等于阈值，不触发预警）；查询 /alerts 不包含 SKU008；生成 InventoryLog 库存预占记录，delta=-1
> FR‑ID: FR‑04
> TC‑FR04‑03

## FR-05 通知 (Should)

- **Given** 客户存在一条状态为 CREATED 的订单
- **When** 订单状态发生变更
- **Then** 状态变化后站内出现未读通知
> FR-ID: FR-05
> TC-FR05-01
