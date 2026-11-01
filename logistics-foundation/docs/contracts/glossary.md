# 领域词汇表 · 当前实现口径

> 来源为旧glossary，库存定义已按冻结实现收敛。角色表描述完整需求目标，不等于当前功能全实现；实际权限看../closure/scope-and-srs-addendum.md。

## 实体词条

| 词条（中文） | English | 定义口径 |
| --- | --- | --- |
| 订单 | Order | 客户发起的购买记录，有唯一订单号 |
| 订单号 | Order Number | 内部流水号（如 ORD-20261027-0001），区别于运单号 |
| 单品 | SKU / Product | 可库存、可售卖的最小商品单位 |
| 库存 | Inventory | 当前实现指可用库存Product.stock；确认时扣占，发货不再扣；没有reserved字段 |
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

## 完整设计目标（非当前完成声明）

| 角色 | 能做什么（Must 范围） |
| --- | --- |
| Customer 客户 | 注册登录、创建订单、查询订单与运单追踪、收通知 |
| Staff 员工 | 确认订单、拣货发货、生成运输单、入库、查看库存预警 |
| Admin 管理员 | 查看看板与报表（Should，Sprint 2）；不直接改订单数据 |
