# 数据模型 · Data Model (v0)

> **单一真源**：`prisma/schema.prisma`（SQLite + Prisma）。任何改动须 PR 且经组长终审；**2026-10-26 Sprint 0 结束冻结 v1**，此后走变更控制。

## 通用约定

- 主键：`id String @id @default(cuid())`
- 时间：一律带 `createdAt` / `updatedAt`（`@default(now())` / `@updatedAt`）
- 金额：**整数分**（cents），禁浮点，防精度与四舍五入口径之争
- 枚举：order 状态与 role 用 Prisma enum，与状态机三处同源

## 实体表

| 实体 | 核心字段 | 约束/备注 |
| --- | --- | --- |
| User | id, email, name, passwordHash, role | email 唯一；role ∈ CUSTOMER / STAFF / ADMIN |
| Product | id, sku, name, priceCents, stock, lowStockThreshold | sku 唯一；stock 是「账面在库」，变动记 InventoryLog |
| Order | id, orderNumber, customerId, status, totalCents | orderNumber 唯一；status 见状态机 |
| OrderItem | id, orderId, productId, quantity, unitPriceCents | 快照下单时单价，改价不影响历史单 |
| Shipment | id, orderId, trackingNumber, carrier, status, shippedAt, deliveredAt | orderId 唯一；trackingNumber 唯一 |
| TrackingEvent | id, shipmentId, at, location, description | 在途时点记录，正序查询 |
| Notification | id, userId, type, content, read, createdAt | 演示用站内通知 |
| InventoryLog | id, productId, delta, reason, orderId?, createdAt | 不可删改；库存流水账＝过程证据 |
