import type { PrismaClient } from "@prisma/client";
import { failure, HttpError, isRetryable, readJsonBody, requireSession } from "@/lib/http";
import { notifyOrderEvent } from "@/lib/notify";

/**
 * POST /api/v1/shipments
 * STAFF 专属。同一事务内：PICKING -> SHIPPED、生成唯一 LG 运单、初始追踪事件、客户通知。
 * 库存已在确认时预占，发货不再扣减。
 */
export function createShipmentHandlers(db: PrismaClient) {
  async function createShipment(req: Request): Promise<Response> {
    try {
      await requireSession(db, req, { roles: ["STAFF"] });
      const body = await readJsonBody(req);
      const { orderNumber, carrier } = body;
      if (typeof orderNumber !== "string" || !orderNumber.trim()) {
        throw new HttpError(400, "INVALID_ARGUMENT", "请提供 ORD 订单号");
      }
      if (typeof carrier !== "string" || !carrier.trim() || carrier.trim().length > 40) {
        throw new HttpError(400, "INVALID_ARGUMENT", "请提供承运商（1–40 字）");
      }
      const number = orderNumber.trim();
      const carrierName = carrier.trim();

      for (let attempt = 0; ; attempt++) {
        try {
          const result = await db.$transaction(async tx => {
            // 第一条是条件写：原子抢占 PICKING -> SHIPPED，重复/并发发货无法穿过。
            const claimed = await tx.order.updateMany({
              where: { orderNumber: number, status: "PICKING" },
              data: { status: "SHIPPED" },
            });
            if (claimed.count !== 1) {
              const existing = await tx.order.findUnique({
                where: { orderNumber: number },
                select: { id: true, status: true, shipment: { select: { id: true } } },
              });
              if (!existing) throw new HttpError(404, "ORDER_NOT_FOUND", "订单不存在");
              if (existing.shipment) throw new HttpError(409, "SHIPMENT_EXISTS", "该订单已发货，不可重复生成运单");
              throw new HttpError(409, "INVALID_STATE_TRANSITION", "只有拣货中（PICKING）订单可以发货");
            }
            const order = await tx.order.findUniqueOrThrow({
              where: { orderNumber: number },
              select: { id: true, orderNumber: true, status: true, totalCents: true, customerId: true },
            });
            // 保留既有 UTC 编号口径；每天 6 位序号。
            const today = new Date().toISOString().slice(0, 10).replaceAll("-", "");
            const prefix = `LG-${today}-`;
            const latest = await tx.shipment.findFirst({
              where: { trackingNumber: { startsWith: prefix } },
              orderBy: { trackingNumber: "desc" },
              select: { trackingNumber: true },
            });
            const sequence = latest ? Number(latest.trackingNumber.slice(prefix.length)) + 1 : 1;
            if (!Number.isInteger(sequence) || sequence > 999999) {
              throw new HttpError(503, "TEMPORARILY_UNAVAILABLE", "当日运单编号不可分配，请联系负责人");
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
            await tx.trackingEvent.create({
              data: { shipmentId: shipment.id, location: "仓库", description: `已发货，交由 ${carrierName} 承运（模拟物流）` },
            });
            await notifyOrderEvent(tx, {
              orderId: order.id,
              userId: order.customerId,
              orderNumber: order.orderNumber,
              type: "SHIPMENT_SHIPPED",
            });
            return {
              shipment,
              order: { id: order.id, orderNumber: order.orderNumber, status: order.status, totalCents: order.totalCents },
            };
          }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 15000 });
          return Response.json(result, { status: 201 });
        } catch (error) {
          if (error instanceof HttpError || !isRetryable(error) || attempt >= 2) throw error;
          await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
        }
      }
    } catch (error) {
      return failure(error, "Shipment API unexpected failure");
    }
  }
  return { createShipment };
}
