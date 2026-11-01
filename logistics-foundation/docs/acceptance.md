# 当前验收场景

本表对应现行实现；旧分支和旧main记录保留在reference/legacy及Git历史，不冒称本轮执行。

| 关联 | Given | When | Then | 验证入口 |
|---|---|---|---|---|
| FR-01 | 有客户演示账号、SKU及足够库存 | 提交正整数数量 | 201/CREATED、ORD、服务端合计/快照；库存与日志不变 | foundation.integration |
| FR-01/04 | SKU007库存4 | 创建10件 | 400可读库存不足、不建单 | foundation+browser |
| FR-02/04 | CREATED，库存足够 | STAFF确认 | 原子扣可用库存、每SKU一条ORDER_CONFIRM、CONFIRMED | orders.integration |
| FR-02 | CONFIRMED | 再确认 | 409；库存/流水不变 | orders+browser |
| FR-02/04 | A创建时库存10，后B确认7件占用，剩3 | 确认A的10件 | 409；A仍CREATED，库存3，无A确认日志 | foundation.integration |
| FR-02 | CREATED | 请求DELIVERED | 409非法转换，数据不变 | orders.integration |
| FR-02 | CONFIRMED | 拣货 | PICKING；库存/流水不变 | logistics-chain.integration |
| FR-03/04 | PICKING | 发货 | 201、唯一LG、SHIPPED及初始事件同事务；不再扣库存 | logistics-chain+browser |
| FR-03 | 已发货 | 顺序/并发重复发货 | 409；仅一张运单 | logistics-chain.integration |
| FR-02/03 | SHIPPED且有运单 | STAFF模拟揽收再签收 | IN_TRANSIT→DELIVERED，三条正序事件，库存不变 | logistics-chain+browser |
| FR-07 | CUSTOMER或ADMIN演示身份 | 修改履约状态/发货 | 403，无业务变更；缺身份401 | logistics-chain.integration |
| FR-03 | 状态修改成功但追踪读取500/网络错 | 页面刷新 | 保留订单/成功结果，单独提示追踪故障，不诱导重复提交 | browser-smoke |

取消、独立预警/补货、通知、报表和真实鉴权尚未实现；不能执行相应场景，也不能将它们从完整需求中删除。
