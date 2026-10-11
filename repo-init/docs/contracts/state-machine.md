# 订单状态机 · Order State Machine (v0)

> **唯一真源**：本文件 + `lib/constants.ts`（枚举＋合法转移表）＋ Prisma enum。三处必须一致，改动同 PR。
> 界面不得硬编码状态文案；一律经枚举映射渲染。非法转移后端回 `409`。

## 状态表

| 值 | 中文 | 含义 | 终态 |
| --- | --- | --- | --- |
| CREATED | 已创建 | 客户提交，订单落库；库存未预占 | 否 |
| CONFIRMED | 已确认 | 员工校验库存后确认履约；库存已预占（记流水） | 否 |
| PICKING | 拣货中 | 仓库拣货 | 否 |
| SHIPPED | 已发货 | 已生成运输单＋运单号 | 否 |
| IN_TRANSIT | 在途 | 承运商揽收，跟踪事件更新中 | 否 |
| DELIVERED | 已签收 | 送达，业务终态 | 是 |
| CANCELLED | 已取消 | 仅 CREATED / CONFIRMED 可入；如已预占则释放库存 | 是 |

## 合法转移表

| 从 | 到 | 触发动作 | 校验 | 关联 |
| --- | --- | --- | --- | --- |
| CREATED | CONFIRMED | 员工点「确认」 | 库存充足 | FR-02 |
| CREATED | CANCELLED | 客户取消 | — | FR-02 |
| CONFIRMED | CANCELLED | 员工/客户取消 | 释放预占库存 | FR-02 |
| CONFIRMED | PICKING | 员工开始拣货 | 未取消 | FR-02 |
| PICKING | SHIPPED | 员工发货：生成运单号（LG-YYYYMMDD-XXXXXX，唯一） | 订单已拣货 | FR-02 / FR-03 |
| SHIPPED | IN_TRANSIT | 承运商揽收（模拟动作） | 已有运单号 | FR-03 |
| IN_TRANSIT | DELIVERED | 客户签收（或模拟送达） | — | FR-03 |

每一个转移 = 一个函数 + 一个单元测试。

## 军法

1. 加状态、改转移：先开 Issue，经组长批准，再同 PR 改三处真源。
2. 非法转移：HTTP `409 INVALID_STATE_TRANSITION`，且不产生任何数据变更。
3. RETURNED（退货）在 Should 池，未经批准不实现——砍产品不砍过程。
