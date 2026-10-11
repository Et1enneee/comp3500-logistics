# 领域词汇表 · Domain Glossary (v0)

> **一义一词，本表即真源。** 七人所有文档、Issue、代码、会议用语一律用本表词条。要立新词：先提 PR 增词条，再用。语义要变：改本表并全仓同步，不许各写各的。

## 实体词条

| 词条（中文） | English | 定义口径 |
| --- | --- | --- |
| 订单 | Order | 客户发起的购买记录，有唯一订单号 |
| 订单号 | Order Number | 内部流水号（如 ORD-20261027-0001），区别于运单号 |
| 单品 | SKU / Product | 可库存、可售卖的最小商品单位 |
| 库存 | Inventory | 某 SKU 当前在库数量，变动一律记流水 |
| 库存流水 | Inventory Log | 每次库存变动的账目（增减、缘由、关联单） |
| 运输单 | Shipment | 一次发货动作，挂唯一运单号 |
| 运单号 | Tracking Number | 客户追踪用单号，终身唯一 |
| 承运商 | Carrier | 承担运输的一方（演示用模拟数据） |
| 跟踪事件 | Tracking Event | 运单在途时点记录（时间、地点、描述） |
| 预警 | Alert | 库存低于阈值的系统提示 |
| 通知 | Notification | 状态变化推送（演示用站内模拟） |
| 角色 | Role | CUSTOMER / STAFF / ADMIN 三类用户 |

## 状态值（与状态机同源，一处定义）

| 值 | 中文 | 值 | 中文 |
| --- | --- | --- | --- |
| CREATED | 已创建 | SHIPPED | 已发货 |
| CONFIRMED | 已确认 | IN_TRANSIT | 在途 |
| PICKING | 拣货中 | DELIVERED | 已签收 |
| CANCELLED | 已取消 |  |  |

## 角色与权限

| 角色 | 能做什么（Must 范围） |
| --- | --- |
| Customer 客户 | 注册登录、创建订单、查询订单与运单追踪、收通知 |
| Staff 员工 | 确认订单、拣货发货、生成运输单、入库、查看库存预警 |
| Admin 管理员 | 查看看板与报表（Should，Sprint 2）；不直接改订单数据 |
