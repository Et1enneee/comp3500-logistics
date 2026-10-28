import type { PrismaClient } from "@prisma/client";
import type { OrderApiErrorCode } from "@/types/orders";

class ShipmentApiError extends Error {
  constructor(public status: number, public code: OrderApiErrorCode, message: string) {
    super(message);
  }
}
function errorResponse(status: number, code: OrderApiErrorCode, message: string) {
  return Response.json({ error: { code, message } }, { status });
}
function isRetryable(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  // Transaction conflicts / busy timeouts / unique collision on the waybill number.
  return error.code === "P2034" || error.code === "P1008" || error.code === "P2002";
}
function failure(error: unknown): Response {
  if (error instanceof ShipmentApiError) return errorResponse(error.status, error.code, error.message);
  if (isRetryable(error)) return errorResponse(503, "TEMPORARILY_UNAVAILABLE", "数据库暂时繁忙，请稍后重试");
  console.error("Shipment API unexpected failure", error instanceof Error ? error.name : "UnknownError");
  return errorResponse(500, "INTERNAL_ERROR", "服务器处理失败，请稍后重试");
}

export function createShipmentHandlers(db: PrismaClient) {
  async function createShipment(req: Request): Promise<Response> {
    const contentType = req.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (contentType !== "application/json") return errorResponse(400, "INVALID_ARGUMENT", "请求须使用application/json");
    let body: unknown;
    try { body = await req.json(); }
    catch { return errorResponse(400, "INVALID_ARGUMENT", "请求体必须是有效JSON"); }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return errorResponse(400, "INVALID_ARGUMENT", "请求内容格式不正确");
    }
    const { orderNumber, carrier } = body as { orderNumber?: unknown; carrier?: unknown };
    if (typeof orderNumber !== "string" || !orderNumber.trim()) {
      return errorResponse(400, "INVALID_ARGUMENT", "请提供 ORD 订单号");
    }
    if (typeof carrier !== "string" || !carrier.trim() || carrier.trim().length > 40) {
      return errorResponse(400, "INVALID_ARGUMENT", "请提供承运商（1–40 字）");
    }
    const email = req.headers.get("x-demo-user-email")?.trim();
    if (!email) return errorResponse(401, "UNAUTHENTICATED", "请提供演示账号邮箱");
    try {
      // Identity comes from the DB, never from a client-supplied role.
      const actor = await db.user.findUnique({ where: { email }, select: { id: true, role: true } });
      if (!actor) return errorResponse(401, "UNAUTHENTICATED", "无法识别演示账号");
      if (actor.role !== "STAFF") return errorResponse(403, "FORBIDDEN", "仅STAFF演示账号可发货");
      const number = orderNumber.trim();
      const carrierName = carrier.trim();
      for (let attempt = 0; ; attempt++) {
        try {
          const result = await db.$transaction(async (tx) => {
            // FIRST statement is a conditional WRITE that atomically claims PICKING -> SHIPPED.
            // Duplicate (sequential or concurrent) requests cannot pass this gate twice.
            const claimed = await tx.order.updateMany({
              where: { orderNumber: number, status: "PICKING" },
              data: { status: "SHIPPED" },
            });
            if (claimed.count !== 1) {
              const existing = await tx.order.findUnique({
                where: { orderNumber: number },
                select: { id: true, status: true, shipment: { select: { id: true } } },
              });
              if (!existing) throw new ShipmentApiError(404, "ORDER_NOT_FOUND", "订单不存在");
              if (existing.shipment) throw new ShipmentApiError(409, "SHIPMENT_EXISTS", "该订单已发货，不可重复生成运单");
              throw new ShipmentApiError(409, "INVALID_STATE_TRANSITION", "只有拣货中（PICKING）订单可以发货");
            }
            const order = await tx.order.findUniqueOrThrow({
              where: { orderNumber: number },
              select: { id: true, orderNumber: true, status: true, totalCents: true },
            });
            // Preserve the existing UTC calendar-day convention; 6-digit daily sequence.
            const today = new Date().toISOString().slice(0, 10).replaceAll("-", "");
            const prefix = `LG-${today}-`;
            const latest = await tx.shipment.findFirst({
              where: { trackingNumber: { startsWith: prefix } },
              orderBy: { trackingNumber: "desc" },
              select: { trackingNumber: true },
            });
            const sequence = latest ? Number(latest.trackingNumber.slice(prefix.length)) + 1 : 1;
            if (!Number.isInteger(sequence) || sequence > 999999) {
              throw new ShipmentApiError(503, "TEMPORARILY_UNAVAILABLE", "当日运单编号不可分配，请联系负责人");
            }
            const shipment = await tx.shipment.create({
              data: {
                orderId: order.id,
                trackingNumber: prefix + String(sequence).padStart(6, "0"),
                carrier: carrierName,
                status: "SHIPPED",
                shippedAt: new Date(),
              },
              select: { id: true, trackingNumber: true, carrier: true, status: true, shippedAt: true },
            });
            // Initial tracking event; stock is NOT touched (reserved at confirmation).
            await tx.trackingEvent.create({
              data: { shipmentId: shipment.id, location: "仓库", description: `已发货，交由 ${carrierName} 承运` },
            });
            return { shipment, order };
          }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 15000 });
          return Response.json(result, { status: 201 });
        } catch (error) {
          if (error instanceof ShipmentApiError || !isRetryable(error) || attempt >= 2) throw error;
          await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
        }
      }
    } catch (error) { return failure(error); }
  }
  return { createShipment };
}
