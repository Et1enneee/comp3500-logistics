import type { PrismaClient } from "@prisma/client";
import { failure, HttpError, isRetryable, readJsonBody, requireSession } from "@/lib/http";
import { notifyOrderEvent } from "@/lib/notify";

/**
 * POST /api/v1/shipments
 * STAFF only. Within one transaction: PICKING -> SHIPPED, generate a unique LG tracking number,
 * the initial tracking event, and the customer notification.
 * Stock was already reserved at confirmation; shipping never deducts again.
 */
export function createShipmentHandlers(db: PrismaClient) {
  async function createShipment(req: Request): Promise<Response> {
    try {
      await requireSession(db, req, { roles: ["STAFF"] });
      const body = await readJsonBody(req);
      const { orderNumber, carrier } = body;
      if (typeof orderNumber !== "string" || !orderNumber.trim()) {
        throw new HttpError(400, "INVALID_ARGUMENT", "Please provide the ORD order number");
      }
      if (typeof carrier !== "string" || !carrier.trim() || carrier.trim().length > 40) {
        throw new HttpError(400, "INVALID_ARGUMENT", "Please provide a carrier (1–40 characters)");
      }
      const number = orderNumber.trim();
      const carrierName = carrier.trim();

      for (let attempt = 0; ; attempt++) {
        try {
          const result = await db.$transaction(async tx => {
            // The first statement is a conditional write: atomically claim PICKING -> SHIPPED; duplicate/concurrent shipments cannot slip through.
            const claimed = await tx.order.updateMany({
              where: { orderNumber: number, status: "PICKING" },
              data: { status: "SHIPPED" },
            });
            if (claimed.count !== 1) {
              const existing = await tx.order.findUnique({
                where: { orderNumber: number },
                select: { id: true, status: true, shipment: { select: { id: true } } },
              });
              if (!existing) throw new HttpError(404, "ORDER_NOT_FOUND", "Order not found");
              if (existing.shipment) throw new HttpError(409, "SHIPMENT_EXISTS", "The order has already shipped; a shipment cannot be created twice");
              throw new HttpError(409, "INVALID_STATE_TRANSITION", "Only picking (PICKING) orders can be shipped");
            }
            const order = await tx.order.findUniqueOrThrow({
              where: { orderNumber: number },
              select: { id: true, orderNumber: true, status: true, totalCents: true, customerId: true },
            });
            // Keep the existing UTC numbering convention; 6-digit sequence per day.
            const today = new Date().toISOString().slice(0, 10).replaceAll("-", "");
            const prefix = `LG-${today}-`;
            const latest = await tx.shipment.findFirst({
              where: { trackingNumber: { startsWith: prefix } },
              orderBy: { trackingNumber: "desc" },
              select: { trackingNumber: true },
            });
            const sequence = latest ? Number(latest.trackingNumber.slice(prefix.length)) + 1 : 1;
            if (!Number.isInteger(sequence) || sequence > 999999) {
              throw new HttpError(503, "TEMPORARILY_UNAVAILABLE", "No tracking number can be allocated for today; please contact the project owner");
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
              data: { shipmentId: shipment.id, location: "Warehouse", description: `Shipped and handed over to ${carrierName} (simulated logistics)` },
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
