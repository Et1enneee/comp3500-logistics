import type { PrismaClient } from "@prisma/client";
import type { OrderApiErrorCode } from "@/types/orders";

class ApiError extends Error {
  constructor(public status: number, public code: OrderApiErrorCode, message: string) {
    super(message);
  }
}
function errorResponse(status: number, code: OrderApiErrorCode, message: string) {
  return Response.json({ error: { code, message } }, { status });
}
function isRetryable(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  // Only transaction conflicts / database-operation timeouts are retried.
  return error.code === "P2034" || error.code === "P1008";
}
function failure(error: unknown): Response {
  if (error instanceof ApiError) return errorResponse(error.status, error.code, error.message);
  if (isRetryable(error)) return errorResponse(503, "TEMPORARILY_UNAVAILABLE", "数据库暂时繁忙，请稍后重试");
  console.error("Order API unexpected failure", error instanceof Error ? error.name : "UnknownError");
  return errorResponse(500, "INTERNAL_ERROR", "服务器处理失败，请稍后重试");
}

// v0.3：状态路由在保留 CONFIRMED 事务的前提下，扩展以下目标。
// SHIPPED 必须走 POST /api/v1/shipments（需要承运商）；CANCELLED 本版未实现。
const TRANSITION_TARGETS = ["CONFIRMED", "PICKING", "IN_TRANSIT", "DELIVERED"] as const;
type TransitionTarget = (typeof TRANSITION_TARGETS)[number];

export function createOrderHandlers(db: PrismaClient) {
  async function getOrder(req: Request): Promise<Response> {
    const orderNumber = new URL(req.url).searchParams.get("orderNumber")?.trim();
    if (!orderNumber) return errorResponse(400, "INVALID_ARGUMENT", "请提供订单号");
    try {
      const order = await db.order.findUnique({
        where: { orderNumber },
        include: {
          items: { include: { product: { select: { sku: true, name: true } } } },
          // Preserve the existing customer object but NEVER expose passwordHash.
          customer: { select: { id: true, email: true, name: true } },
        },
      });
      if (!order) return errorResponse(404, "ORDER_NOT_FOUND", "订单不存在");
      return Response.json({ order });
    } catch (error) { return failure(error); }
  }

  async function confirmOrder(req: Request, id: string): Promise<Response> {
    if (!id?.trim()) return errorResponse(400, "INVALID_ARGUMENT", "请提供订单内部ID");
    const contentType = req.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (contentType !== "application/json") return errorResponse(400, "INVALID_ARGUMENT", "请求须使用application/json");
    let body: unknown;
    try { body = await req.json(); }
    catch { return errorResponse(400, "INVALID_ARGUMENT", "请求体必须是有效JSON"); }
    if (!body || typeof body !== "object" || Array.isArray(body) || !("to" in body)) {
      return errorResponse(400, "INVALID_ARGUMENT", "请求体须包含 to");
    }
    const target = (body as { to: unknown }).to;
    if (!TRANSITION_TARGETS.includes(target as TransitionTarget)) {
      const hint = target === "SHIPPED"
        ? "发货请使用 POST /api/v1/shipments（需要承运商）"
        : "本阶段支持 to 为 CONFIRMED / PICKING / IN_TRANSIT / DELIVERED";
      return errorResponse(400, "INVALID_ARGUMENT", hint);
    }
    const to = target as TransitionTarget;
    const email = req.headers.get("x-demo-user-email")?.trim();
    if (!email) return errorResponse(401, "UNAUTHENTICATED", "请提供演示账号邮箱");
    try {
      // Identity comes from the DB, never from a client-supplied role.
      const actor = await db.user.findUnique({ where: { email }, select: { id: true, role: true } });
      if (!actor) return errorResponse(401, "UNAUTHENTICATED", "无法识别演示账号");
      if (actor.role !== "STAFF") return errorResponse(403, "FORBIDDEN", "仅STAFF演示账号可执行订单状态操作");
      if (to === "CONFIRMED") {
      for (let attempt = 0; ; attempt++) {
        try {
          const order = await db.$transaction(async (tx) => {
            // FIRST transaction statement is a conditional WRITE, not a read.
            // SQLite serializes writers. This atomically claims CREATED -> CONFIRMED.
            // Uncommitted state is rolled back if any later operation fails.
            const claimed = await tx.order.updateMany({
              where: { id, status: "CREATED" }, data: { status: "CONFIRMED" },
            });
            if (claimed.count !== 1) {
              const exists = await tx.order.findUnique({ where: { id }, select: { id: true } });
              if (!exists) throw new ApiError(404, "ORDER_NOT_FOUND", "订单不存在");
              throw new ApiError(409, "INVALID_STATE_TRANSITION", "只有CREATED订单可以确认，且不能重复确认");
            }
            const current = await tx.order.findUnique({ where: { id }, include: { items: true } });
            if (!current || current.items.length === 0) throw new ApiError(400, "INVALID_ARGUMENT", "订单缺少有效商品明细");
            const quantities = new Map<string, number>();
            for (const item of current.items) {
              if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) throw new ApiError(400, "INVALID_ARGUMENT", "订单商品数量必须为正整数");
              const quantity = (quantities.get(item.productId) ?? 0) + item.quantity;
              if (!Number.isSafeInteger(quantity) || quantity > 2147483647) throw new ApiError(400, "INVALID_ARGUMENT", "订单商品数量超出范围");
              quantities.set(item.productId, quantity);
            }
            // Stable product ordering also reduces lock-order conflicts on other DBs.
            for (const [productId, quantity] of [...quantities.entries()].sort(([a], [b]) => a.localeCompare(b))) {
              // Conditional decrement combines stock check + reservation atomically.
              const reserved = await tx.product.updateMany({
                where: { id: productId, stock: { gte: quantity } },
                data: { stock: { decrement: quantity } },
              });
              if (reserved.count !== 1) throw new ApiError(409, "INSUFFICIENT_STOCK", "库存不足，无法确认订单");
              await tx.inventoryLog.create({ data: {
                productId, orderId: id, delta: -quantity, reason: "ORDER_CONFIRM",
              } });
            }
            return tx.order.findUniqueOrThrow({ where: { id }, select: {
              id: true, orderNumber: true, status: true, totalCents: true,
            } });
          }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 15000 });
          return Response.json({ order });
        } catch (error) {
          // Prisma rolls back failed interactive transactions before rejecting.
          // Business errors are NEVER retried. At most three complete attempts.
          if (!isRetryable(error) || attempt >= 2) throw error;
          await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
        }
      }
      } else {
        // PICKING / IN_TRANSIT / DELIVERED：条件更新是事务第一条语句，失败整体回滚。
        const expectedFrom = to === "PICKING" ? "CONFIRMED" : to === "IN_TRANSIT" ? "SHIPPED" : "IN_TRANSIT";
        const actionLabel = to === "PICKING" ? "开始拣货" : to === "IN_TRANSIT" ? "模拟揽收" : "模拟签收";
        for (let attempt = 0; ; attempt++) {
          try {
            const order = await db.$transaction(async (tx) => {
              const claimed = await tx.order.updateMany({
                where: { id, status: expectedFrom }, data: { status: to },
              });
              if (claimed.count !== 1) {
                const exists = await tx.order.findUnique({ where: { id }, select: { id: true } });
                if (!exists) throw new ApiError(404, "ORDER_NOT_FOUND", "订单不存在");
                throw new ApiError(409, "INVALID_STATE_TRANSITION", `只有 ${expectedFrom} 订单可以${actionLabel}，且不能重复操作`);
              }
              if (to === "IN_TRANSIT" || to === "DELIVERED") {
                const shipment = await tx.shipment.findUnique({
                  where: { orderId: id }, select: { id: true, carrier: true },
                });
                if (!shipment) throw new ApiError(409, "SHIPMENT_NOT_FOUND", "订单尚无运单，无法更新物流状态");
                await tx.shipment.update({
                  where: { orderId: id },
                  data: { status: to, ...(to === "DELIVERED" ? { deliveredAt: new Date() } : {}) },
                });
                await tx.trackingEvent.create({ data: {
                  shipmentId: shipment.id,
                  location: to === "IN_TRANSIT" ? "揽收网点" : "收件地址",
                  description: to === "IN_TRANSIT" ? `承运商 ${shipment.carrier} 已揽收` : "收件人已签收",
                } });
              }
              return tx.order.findUniqueOrThrow({ where: { id }, select: {
                id: true, orderNumber: true, status: true, totalCents: true,
              } });
            }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 15000 });
            return Response.json({ order });
          } catch (error) {
            if (!isRetryable(error) || attempt >= 2) throw error;
            await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
          }
        }
      }
    } catch (error) { return failure(error); }
  }

  async function getTracking(_req: Request, id: string): Promise<Response> {
    if (!id?.trim()) return errorResponse(400, "INVALID_ARGUMENT", "请提供订单内部ID");
    try {
      const order = await db.order.findUnique({
        where: { id },
        include: { shipment: { include: { events: { orderBy: { at: "asc" } } } } },
      });
      if (!order) return errorResponse(404, "ORDER_NOT_FOUND", "订单不存在");
      if (!order.shipment) return errorResponse(404, "SHIPMENT_NOT_FOUND", "订单尚未发货，暂无运单");
      return Response.json({
        trackingNumber: order.shipment.trackingNumber,
        carrier: order.shipment.carrier,
        status: order.shipment.status,
        events: order.shipment.events.map(event => ({ at: event.at, location: event.location, description: event.description })),
      });
    } catch (error) { return failure(error); }
  }

  return { getOrder, confirmOrder, getTracking };
}
