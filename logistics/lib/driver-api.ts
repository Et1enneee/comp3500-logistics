import type { PrismaClient } from "@prisma/client";
import { failure, HttpError, readJsonBody, requireSession } from "@/lib/http";

/** The driver receives only their own assignments and the delivery address and operational details, not customer name or contact information. */
export async function queryDriverTasks(db: PrismaClient, driverId: string) {
  return db.shipment.findMany({
    where: { driverId, order: { status: { in: ["SHIPPED", "IN_TRANSIT", "DELIVERED"] } } },
    orderBy: [{ shippedAt: "desc" }, { id: "desc" }],
    select: {
      trackingNumber: true,
      status: true,
      carrier: true,
      order: {
        select: {
          id: true, orderNumber: true, status: true, deliveryAddress: true,
          items: { select: { quantity: true, product: { select: { sku: true, name: true } } } },
        },
      },
    },
  });
}

export function createDriverHandlers(db: PrismaClient) {
  async function list(req: Request) {
    try {
      const { user } = await requireSession(db, req, { roles: ["DRIVER"] });
      return Response.json({ tasks: await queryDriverTasks(db, user.id) });
    } catch (error) { return failure(error, "Driver tasks unexpected failure"); }
  }

  /** STAFF may assign or reassign a shipped order before pickup; after pickup the assignment is locked. */
  async function assign(req: Request, orderId: string) {
    try {
      await requireSession(db, req, { roles: ["STAFF"] });
      if (!orderId?.trim()) throw new HttpError(400, "INVALID_ARGUMENT", "Please provide the order ID");
      const body = await readJsonBody(req);
      if (typeof body.driverId !== "string" || !body.driverId.trim()) {
        throw new HttpError(400, "INVALID_ARGUMENT", "Please choose a driver");
      }
      const driverId = body.driverId.trim();
      const driver = await db.user.findFirst({ where: { id: driverId, role: "DRIVER" }, select: { id: true } });
      if (!driver) throw new HttpError(400, "INVALID_ARGUMENT", "The selected driver is not available");
      // The state check and assignment are a single write, so pickup cannot race a late reassignment.
      const updated = await db.shipment.updateMany({
        where: { orderId, order: { status: "SHIPPED" } },
        data: { driverId },
      });
      if (updated.count !== 1) {
        const exists = await db.order.findUnique({ where: { id: orderId }, select: { id: true } });
        if (!exists) throw new HttpError(404, "ORDER_NOT_FOUND", "Order not found");
        throw new HttpError(409, "INVALID_STATE_TRANSITION", "Assign a driver only after shipping and before pickup");
      }
      return Response.json({ orderId, driverId });
    } catch (error) { return failure(error, "Driver assignment unexpected failure"); }
  }
  return { list, assign };
}
