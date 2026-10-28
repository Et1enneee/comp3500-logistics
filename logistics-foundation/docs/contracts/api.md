# v0.3.1 订单与物流接口（当前实现）

当前实现下单、按单号查询、员工确认/拣货、发货、追踪与模拟揽收/签收。沿用原订单确认语义，不支持取消。范围与验证入口见 ../closure/README.md；真实认证、客户所有权及未实现设计不得由本接口表推定为已完成。

## GET /api/v1/orders?orderNumber=ORD-…

按页面 ORD 单号精确查询，不提供列表。空白参数视为空。
200 返回 `{ "order": ... }`。原 Order/OrderItem 字段不改名；在 items 中新增 product.sku / product.name。
客户仅保留 id/email/name，移除密码哈希等无关字段。金额均为整数分。
响应样例见 `get-order.example.json`。该文件保存了2026-10-26本地HTTP查询的真实演示响应：订单ORD-20261026-0001，状态CONFIRMED，商品SKU001 × 2，总额300分。它是当时的响应快照，前端不能硬编码其中的ID、订单号、金额或状态。确认接口路径中的{id}必须使用本次查询返回的order.id。

## PATCH /api/v1/orders/{id}/status

{id} 只解释为数据库内部 order.id，不猜测、不回退为 ORD 单号。
请求头：Content-Type: application/json；X-Demo-User-Email: User 表中的演示邮箱（必填）。
请求体：`{ "to": "CONFIRMED" | "PICKING" | "IN_TRANSIT" | "DELIVERED" }`（v0.3 起）。
200：`{ "order": { "id": "…", "orderNumber": "ORD-…", "status": "<目标状态>", "totalCents": 300 } }`

| to | 允许的当前状态 | 副作用（同一事务） |
| --- | --- | --- |
| CONFIRMED | CREATED | 可用库存 -= 数量；每种商品一条 delta=-quantity / reason=ORDER_CONFIRM 流水 |
| PICKING | CONFIRMED | 仅状态变更；不扣库存、不写库存流水 |
| IN_TRANSIT | SHIPPED | 运单状态→IN_TRANSIT；新增一条揽收 TrackingEvent（揽收网点） |
| DELIVERED | IN_TRANSIT | 运单状态→DELIVERED、写 deliveredAt；新增一条签收 TrackingEvent（收件地址） |

- 发货（→SHIPPED）不接受 PATCH：返回 400 INVALID_ARGUMENT，message 指引使用 POST /api/v1/shipments。
- 其他目标（如 CANCELLED）本版未实现：400 INVALID_ARGUMENT。
- 同一目标重复提交：409 INVALID_STATE_TRANSITION，且不产生任何副作用。
- IN_TRANSIT/DELIVERED 若订单没有运单：409 SHIPMENT_NOT_FOUND，订单状态回滚。
- 成功后前端再次 GET 同一个 ORD 单号刷新明细；v0.3 前端同时读取追踪。
- 错误码：400 INVALID_ARGUMENT；401 UNAUTHENTICATED；403 FORBIDDEN（非 STAFF）；404 ORDER_NOT_FOUND；409 INSUFFICIENT_STOCK / INVALID_STATE_TRANSITION / SHIPMENT_NOT_FOUND；500/503。

## POST /api/v1/shipments

发货（PICKING → SHIPPED）。仅 STAFF 演示账号。
请求头：Content-Type: application/json；X-Demo-User-Email（必填）。
请求体：`{ "orderNumber": "ORD-YYYYMMDD-XXXX", "carrier": "顺丰速运" }`（carrier 1–40 字）。
201：`{ "shipment": { "id": "…", "trackingNumber": "LG-YYYYMMDD-XXXXXX", "carrier": "…", "status": "SHIPPED", "shippedAt": "…" }, "order": { "id": "…", "orderNumber": "…", "status": "SHIPPED", "totalCents": 300 } }`
同一事务内完成：订单 PICKING→SHIPPED（条件更新）、生成当日唯一运单号、写一条初始 TrackingEvent（仓库）。
库存：不扣减、不写 InventoryLog（库存在确认时已预占）。
错误：400 INVALID_ARGUMENT（非法 JSON / 缺单号 / 缺承运商 / 非 JSON Content-Type）；401 UNAUTHENTICATED；403 FORBIDDEN（非 STAFF）；404 ORDER_NOT_FOUND；409 SHIPMENT_EXISTS（已有运单/已发货，重复请求不会生成第二张）；409 INVALID_STATE_TRANSITION（非 PICKING）；500/503。
顺序或并发重复发货：只产生一张运单；失败不残留运单或追踪事件。

## GET /api/v1/orders/{id}/tracking

{id} 为内部 order.id。只读；与 GET /orders 相同的演示姿态，不要求 X-Demo-User-Email，也无对象级所有权校验（已知限制）。
200：`{ "trackingNumber": "LG-…", "carrier": "…", "status": "SHIPPED|IN_TRANSIT|DELIVERED", "events": [ { "at": "…", "location": "…", "description": "…" } ] }`，events 按时间正序。
错误：400 INVALID_ARGUMENT（空 id）；404 ORDER_NOT_FOUND；404 SHIPMENT_NOT_FOUND（尚未发货）；500。
错误 id 只返回 404，不返回其他订单任何字段。

## 错误

所有本次接口错误使用 `{ "error": { "code": "…", "message": "供用户阅读的说明" } }`。

* 400 INVALID\_ARGUMENT：空单号、非JSON Content-Type、缺失/非法JSON、to缺失或不支持（含 to=SHIPPED，需改走 POST /shipments）。
* 401 UNAUTHENTICATED：演示邮箱缺失或User表查无此人。
* 403 FORBIDDEN：角色不等于STAFF，包括CUSTOMER和ADMIN（发货同样要求 STAFF）。
* 404 ORDER\_NOT\_FOUND：订单不存在（使用有效STAFF进行确认时）。
* 404 SHIPMENT\_NOT\_FOUND：追踪或物流状态更新时订单尚无运单。
* 409 INSUFFICIENT\_STOCK：CREATED订单中任一商品可用库存不足。
* 409 INVALID\_STATE\_TRANSITION：非法流转（已确认/已拣货/已发货等），业务数据不变。
* 409 SHIPMENT\_EXISTS：重复发货，已存在运单；不会生成第二张。
* 额外兜底：500 INTERNAL\_ERROR；可识别的数据库忙/冲突重试耗尽返回503 TEMPORARILY\_UNAVAILABLE。前端应能显示未知code的message。
校验顺序：参数/JSON → 演示身份 → 事务内状态与库存。多种错误同时存在时，按此顺序返回。
空明细或非法历史数量返回400，不产生库存变动。确认处理仍会防御性检查历史订单数量；本候选版 POST 已验证正整数数量。

## 身份限制

邮箱只是演示标识，可被冒用；不是登录认证，不构成安全验收。必须仅在隔离的演示环境使用，不可直接部署为公网生产确认接口。查询身份权限不在此次约定内。

## 前端调用示例（示意，演示邮箱从选择框取得）

```ts
const r = await fetch(`/api/v1/orders?orderNumber=${encodeURIComponent(orderNumber)}`);
const data = await r.json();
if (!r.ok) throw new Error(data.error.message);
const id = data.order.id;
const confirmation = await fetch(`/api/v1/orders/${encodeURIComponent(id)}/status`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json", "X-Demo-User-Email": selectedDemoEmail },
  body: JSON.stringify({ to: "CONFIRMED" }),
});
const result = await confirmation.json();
if (!confirmation.ok) throw new Error(result.error.message);
// 成功后再GET orderNumber，刷新页面状态与明细。
```


## POST /api/v1/orders（地基候选新增校验）

请求 JSON：`{"email":"customer@demo.com","items":[{"sku":"SKU001","quantity":2}]}`。

- 至少 1 条、最多 100 条明细；数量为正整数，重复 SKU 先汇总再预检库存。
- 客户须存在且角色为 CUSTOMER；演示邮箱仍非真实认证。
- 201 返回 `{order}`；商品行记录下单单价快照，服务端计算整数分合计。
- 创建不改变 Product.stock，不产生 InventoryLog；预检不承诺锁定库存。
- 400 INVALID_ARGUMENT：非法 JSON、空订单、非法数量、金额或数量超限。
- 400 CUSTOMER_NOT_FOUND / SKU_NOT_FOUND_<sku> / INSUFFICIENT_STOCK_<sku>：保留相应创建错误类别，message 改为可读说明。
- 403 FORBIDDEN：非 CUSTOMER 演示账号。
- 500 INTERNAL_ERROR / 503 TEMPORARILY_UNAVAILABLE：异常或重试耗尽。
- 编号按 UTC 日历日使用 ORD-YYYYMMDD-XXXX；页面时间显示 GMT+8，因此夜间可能跨不同日期，非错单。每日最多 9999 号；唯一冲突/瞬态争用最多重试三次。未实现客户端创建请求幂等键；结果未知时不得盲目重复提交。

## 页面与数据

`/` 服务端实时读取数据库商品目录，不再把价格或库存硬编码在浏览器中。`/staff` 查询后用 order.id 确认，成功再次查询；v0.3 起同一页面可继续拣货、发货并查看运单追踪。页面不展示库存流水原始表；库存/流水检查由测试或数据库审查执行。GET /orders 仍不含 shipment；追踪走独立端点 GET /orders/{id}/tracking。
