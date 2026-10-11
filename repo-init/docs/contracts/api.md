# API 契约 · API Contract (v0)

> 前缀 `/api/v1`，JSON，UTF-8。编译级契约在 `lib/types.ts`（tsc 不过＝契约破）；本文档是文档级契约。
> **文档闸门**：任何改响应形状的 PR，必须同一 PR 更新本文档与 `lib/types.ts`，缺一不 merge。

## 错误信封（一律此形）

```json
{ "error": { "code": "INVALID_STATE_TRANSITION", "message": "Order 12 cannot move from CREATED to DELIVERED." } }
```

| HTTP | 含义 |
| --- | --- |
| 200 / 201 | 成功（查询 / 创建） |
| 400 | 参数错（枚举值非法、字段缺失） |
| 401 | 未登录 |
| 403 | 越权（角色不允许） |
| 404 | 资源不存在 |
| 409 | 状态冲突（非法流转、重复运单号） |
| 500 | 服务错 |

## 端点表

| 端点 | 方法 | 请求 | 成功响应要点 | 错误 | 需求 | 实现 |
| --- | --- | --- | --- | --- | --- | --- |
| /orders | POST | `{customerId, items:[{sku,quantity}]}` | 201 `{order:{id,orderNumber,status,totalCents,…}}` | 400 / 404 SKU 不存在 | FR-01 | Yin |
| /orders/{id} | GET | — | 200 `{order, items[], shipment?}` | 404 | FR-01 | Yin |
| /orders/{id}/status | PATCH | `{to:"CONFIRMED"}` | 200 `{order}` | 400 / 404 / 409 | FR-02 | Yin |
| /orders/{id}/tracking | GET | — | 200 `{trackingNumber, carrier, status, events:[{at,location,description}]}` | 404 | FR-03 | Yin |
| /shipments | POST | `{orderId, carrier}` | 201 `{shipment:{trackingNumber,…}}` | 400 / 404 / 409（订单未到 PICKING） | FR-03 | Yin |
| /products | GET | `?q=`（可选） | 200 `{products:[…]}` | — | FR-04 | Yin |
| /products/{id}/stock | POST | `{delta, reason}` | 200 `{product}`（自动写 InventoryLog） | 400 / 404 | FR-04 | Yin |
| /alerts | GET | — | 200 `{alerts:[{sku, stock, lowStockThreshold}]}` | — | FR-04 | Yin |
| /notifications | POST | `{userId, type, content}` | 201 | 400 | FR-05 | Yin |
| /notifications | GET | `?userId=` | 200 `{notifications:[…]}` | 400 | FR-05 | Yin |
| /reports/orders | GET | `{from, to}`（Should，Sprint 2） | 200 聚合数据 | 400 | FR-06 | Yin/Tang |

- `{id}` 处用 `orderNumber` 亦可，Sprint 0 定一。
- 列表统一 `?page=1&pageSize=20`。
