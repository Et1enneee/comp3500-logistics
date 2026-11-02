import type { Prisma, PrismaClient } from "@prisma/client";
import type { OrderStatus } from "@/lib/constants";
import { STATUS_LABEL } from "@/lib/constants";
import {
  failure,
  HttpError,
  isRetryable,
  readJsonBody,
  requireSession,
} from "@/lib/http";
import { notifyOrderEvent } from "@/lib/notify";
import { parseOrderParams } from "@/lib/query-params";

const STATUS_VALUES: OrderStatus[] = [
  "CREATED", "CONFIRMED", "PICKING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "CANCELLED",
];

// Status writes go through this single endpoint; SHIPPED must go through POST /api/v1/shipments (a carrier is required).
const TRANSITION_TARGETS = ["CONFIRMED", "PICKING", "IN_TRANSIT", "DELIVERED", "CANCELLED"] as const;
type TransitionTarget = (typeof TRANSITION_TARGETS)[number];

export interface Actor {
  id: string;
  role: "CUSTOMER" | "STAFF" | "ADMIN";
}

const LIST_SELECT = {
  id: true,
  orderNumber: true,
  status: true,
  totalCents: true,
  createdAt: true,
  customer: { select: { name: true, email: true } },
  shipment: { select: { trackingNumber: true } },
  _count: { select: { items: true } },
} as const;

const DETAIL_INCLUDE = {
  items: { include: { product: { select: { sku: true, name: true } } } },
  customer: { select: { id: true, email: true, name: true } },
  shipment: { select: { trackingNumber: true, carrier: true, status: true, shippedAt: true, deliveredAt: true } },
} as const;

export type OrderListRow = Prisma.OrderGetPayload<{ select: typeof LIST_SELECT }>;
export type OrderDetailRow = Prisma.OrderGetPayload<{ include: typeof DETAIL_INCLUDE }>;

export interface OrderListQuery {
  page: number;
  pageSize: number;
  status?: string;
}

/** List query: customers see only their own orders; staff see all. Pages and the API share this single rule. */
export async function queryOrderList(
  db: PrismaClient,
  actor: Actor,
  query: OrderListQuery,
): Promise<{ orders: ReturnType<typeof mapListRow>[]; page: number; pageSize: number; total: number; totalPages: number }> {
  if (actor.role === "ADMIN") throw new HttpError(403, "FORBIDDEN", "Administrators do not view customer order details; they use aggregated reports only");
  const where: { customerId?: string; status?: OrderStatus } = {};
  if (actor.role === "CUSTOMER") where.customerId = actor.id;
  if (query.status) {
    if (!STATUS_VALUES.includes(query.status as OrderStatus)) {
      throw new HttpError(400, "INVALID_ARGUMENT", "The status filter value is invalid");
    }
    where.status = query.status as OrderStatus;
  }
  const skip = (query.page - 1) * query.pageSize;
  const [rows, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: query.pageSize,
      select: LIST_SELECT,
    }),
    db.order.count({ where }),
  ]);
  return {
    orders: rows.map(mapListRow),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

function mapListRow(row: OrderListRow) {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    status: row.status,
    totalCents: row.totalCents,
    createdAt: row.createdAt,
    customer: row.customer,
    itemCount: row._count.items,
    trackingNumber: row.shipment?.trackingNumber ?? null,
  };
}

/** Detail query: a customer accessing someone else's order always gets 404 (existence is not leaked). */
export async function queryOrderDetail(
  db: PrismaClient,
  actor: Actor,
  id: string,
): Promise<OrderDetailRow> {
  if (actor.role === "ADMIN") throw new HttpError(403, "FORBIDDEN", "Administrators do not view customer order details; they use aggregated reports only");
  if (!id?.trim()) throw new HttpError(400, "INVALID_ARGUMENT", "Please provide the order's internal ID");
  const order = await db.order.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!order) throw new HttpError(404, "ORDER_NOT_FOUND", "Order not found");
  if (actor.role === "CUSTOMER" && order.customerId !== actor.id) {
    throw new HttpError(404, "ORDER_NOT_FOUND", "Order not found");
  }
  return order;
}

export async function queryOrderByNumber(
  db: PrismaClient,
  actor: Actor,
  orderNumber: string,
): Promise<OrderDetailRow> {
  if (actor.role === "ADMIN") throw new HttpError(403, "FORBIDDEN", "Administrators do not view customer order details; they use aggregated reports only");
  if (!orderNumber.trim()) throw new HttpError(400, "INVALID_ARGUMENT", "Please provide the order number");
  const order = await db.order.findUnique({ where: { orderNumber }, include: DETAIL_INCLUDE });
  if (!order) throw new HttpError(404, "ORDER_NOT_FOUND", "Order not found");
  if (actor.role === "CUSTOMER" && order.customerId !== actor.id) {
    throw new HttpError(404, "ORDER_NOT_FOUND", "Order not found");
  }
  return order;
}

export async function queryTracking(db: PrismaClient, actor: Actor, id: string) {
  if (actor.role === "ADMIN") throw new HttpError(403, "FORBIDDEN", "Administrators do not view customer shipments");
  if (!id?.trim()) throw new HttpError(400, "INVALID_ARGUMENT", "Please provide the order's internal ID");
  const order = await db.order.findUnique({
    where: { id },
    include: { shipment: { include: { events: { orderBy: [{ at: "asc" }, { id: "asc" }] } } } },
  });
  if (!order) throw new HttpError(404, "ORDER_NOT_FOUND", "Order not found");
  if (actor.role === "CUSTOMER" && order.customerId !== actor.id) {
    throw new HttpError(404, "ORDER_NOT_FOUND", "Order not found");
  }
  if (!order.shipment) throw new HttpError(404, "SHIPMENT_NOT_FOUND", "The order has not shipped yet; no shipment exists");
  return {
    trackingNumber: order.shipment.trackingNumber,
    carrier: order.shipment.carrier,
    status: order.shipment.status,
    events: order.shipment.events.map(event => ({
      at: event.at,
      location: event.location,
      description: event.description,
    })),
  };
}

export function createOrderHandlers(db: PrismaClient) {
  /** GET /api/v1/orders?orderNumber=… (customers can query only their own). */
  async function getOrder(req: Request): Promise<Response> {
    try {
      const { user } = await requireSession(db, req, { roles: ["CUSTOMER", "STAFF"] });
      const orderNumber = new URL(req.url).searchParams.get("orderNumber")?.trim() ?? "";
      if (!orderNumber) throw new HttpError(400, "INVALID_ARGUMENT", "Please provide the order number");
      return Response.json({ order: await queryOrderByNumber(db, user, orderNumber) });
    } catch (error) {
      return failure(error, "Order API unexpected failure");
    }
  }

  /** GET /api/v1/orders?page=&pageSize=&status= */
  async function listOrders(req: Request): Promise<Response> {
    try {
      const { user } = await requireSession(db, req, { roles: ["CUSTOMER", "STAFF"] });
      const url = new URL(req.url);
      const result = await queryOrderList(db, user, parseOrderParams(url.searchParams));
      return Response.json(result);
    } catch (error) {
      return failure(error, "Order list unexpected failure");
    }
  }

  /** GET /api/v1/orders/{internal id} */
  async function getOrderById(req: Request, id: string): Promise<Response> {
    try {
      const { user } = await requireSession(db, req, { roles: ["CUSTOMER", "STAFF"] });
      return Response.json({ order: await queryOrderDetail(db, user, id) });
    } catch (error) {
      return failure(error, "Order detail unexpected failure");
    }
  }

  /**
   * PATCH /api/v1/orders/{internal id}/status
   * STAFF: confirm / pick / simulate pickup / simulate delivery / cancel CONFIRMED
   * CUSTOMER: cancel own CREATED or CONFIRMED
   */
  async function updateStatus(req: Request, id: string): Promise<Response> {
    try {
      const { user } = await requireSession(db, req, { roles: ["STAFF", "CUSTOMER"] });
      if (!id?.trim()) throw new HttpError(400, "INVALID_ARGUMENT", "Please provide the order's internal ID");
      const body = await readJsonBody(req);
      if (!("to" in body)) throw new HttpError(400, "INVALID_ARGUMENT", "The request body must contain \"to\"");
      const target = body.to;
      if (!TRANSITION_TARGETS.includes(target as TransitionTarget)) {
        const hint = target === "SHIPPED"
          ? "To ship, use POST /api/v1/shipments (a carrier is required)"
          : "\"to\" supports CONFIRMED / PICKING / IN_TRANSIT / DELIVERED / CANCELLED only";
        throw new HttpError(400, "INVALID_ARGUMENT", hint);
      }
      const to = target as TransitionTarget;
      if (user.role === "CUSTOMER" && to !== "CANCELLED") {
        throw new HttpError(403, "FORBIDDEN", "Customers can only cancel their own orders; they cannot perform staff fulfillment actions");
      }
      if (to === "CANCELLED") return await cancelOrder(id, user);
      if (to === "CONFIRMED") return await confirmOrder(id, user.id);
      return await advanceOrder(id, to);
    } catch (error) {
      return failure(error, "Order status unexpected failure");
    }
  }

  async function confirmOrder(id: string, actorId: string): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      try {
        const order = await db.$transaction(async tx => {
          // The first statement in the transaction is a conditional write: SQLite serializes writers, atomically claiming CREATED -> CONFIRMED.
          const claimed = await tx.order.updateMany({
            where: { id, status: "CREATED" },
            data: { status: "CONFIRMED" },
          });
          if (claimed.count !== 1) {
            const exists = await tx.order.findUnique({ where: { id }, select: { id: true } });
            if (!exists) throw new HttpError(404, "ORDER_NOT_FOUND", "Order not found");
            throw new HttpError(409, "INVALID_STATE_TRANSITION", "Only CREATED orders can be confirmed, and only once");
          }
          const current = await tx.order.findUnique({ where: { id }, include: { items: true } });
          if (!current || current.items.length === 0) {
            throw new HttpError(400, "INVALID_ARGUMENT", "The order has no valid item lines");
          }
          const quantities = new Map<string, number>();
          for (const item of current.items) {
            if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
              throw new HttpError(400, "INVALID_ARGUMENT", "Order item quantities must be positive integers");
            }
            const quantity = (quantities.get(item.productId) ?? 0) + item.quantity;
            if (!Number.isSafeInteger(quantity) || quantity > 2147483647) {
              throw new HttpError(400, "INVALID_ARGUMENT", "Order item quantity is out of range");
            }
            quantities.set(item.productId, quantity);
          }
          // Deduct in a fixed order to reduce cross-order lock-order conflicts.
          for (const [productId, quantity] of [...quantities.entries()].sort(([a], [b]) => a.localeCompare(b))) {
            const reserved = await tx.product.updateMany({
              where: { id: productId, stock: { gte: quantity } },
              data: { stock: { decrement: quantity } },
            });
            if (reserved.count !== 1) throw new HttpError(409, "INSUFFICIENT_STOCK", "Insufficient stock; the order cannot be confirmed");
            await tx.inventoryLog.create({
              data: { productId, orderId: id, delta: -quantity, reason: "ORDER_CONFIRM", actorId },
            });
          }
          await notifyOrderEvent(tx, {
            orderId: id, userId: current.customerId, orderNumber: current.orderNumber, type: "ORDER_CONFIRMED",
          });
          return tx.order.findUniqueOrThrow({
            where: { id },
            select: { id: true, orderNumber: true, status: true, totalCents: true },
          });
        }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 15000 });
        return Response.json({ order });
      } catch (error) {
        // Prisma has already rolled back before rejecting; business errors are never retried — at most three full attempts.
        if (error instanceof HttpError || !isRetryable(error) || attempt >= 2) throw error;
        await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
      }
    }
  }

  async function advanceOrder(id: string, to: "PICKING" | "IN_TRANSIT" | "DELIVERED"): Promise<Response> {
    const expectedFrom = to === "PICKING" ? "CONFIRMED" : to === "IN_TRANSIT" ? "SHIPPED" : "IN_TRANSIT";
    const actionLabel = to === "PICKING" ? "start picking" : to === "IN_TRANSIT" ? "simulate pickup" : "simulate delivery";
    for (let attempt = 0; ; attempt++) {
      try {
        const order = await db.$transaction(async tx => {
          const claimed = await tx.order.updateMany({
            where: { id, status: expectedFrom },
            data: { status: to },
          });
          if (claimed.count !== 1) {
            const exists = await tx.order.findUnique({ where: { id }, select: { id: true } });
            if (!exists) throw new HttpError(404, "ORDER_NOT_FOUND", "Order not found");
            throw new HttpError(409, "INVALID_STATE_TRANSITION", `Only ${expectedFrom} orders can ${actionLabel}, and the operation cannot be repeated`);
          }
          const current = await tx.order.findUniqueOrThrow({
            where: { id },
            select: { id: true, orderNumber: true, customerId: true },
          });
          if (to === "IN_TRANSIT" || to === "DELIVERED") {
            const shipment = await tx.shipment.findUnique({
              where: { orderId: id },
              select: { id: true, carrier: true },
            });
            if (!shipment) throw new HttpError(409, "SHIPMENT_NOT_FOUND", "The order has no shipment yet; logistics status cannot be updated");
            await tx.shipment.update({
              where: { orderId: id },
              data: { status: to, ...(to === "DELIVERED" ? { deliveredAt: new Date() } : {}) },
            });
            await tx.trackingEvent.create({
              data: {
                shipmentId: shipment.id,
                location: to === "IN_TRANSIT" ? "Pickup station" : "Delivery address",
                description: to === "IN_TRANSIT" ? `Picked up by carrier ${shipment.carrier}` : "Signed for by the recipient",
              },
            });
          }
          if (to === "IN_TRANSIT") {
            await notifyOrderEvent(tx, {
              orderId: id, userId: current.customerId, orderNumber: current.orderNumber, type: "SHIPMENT_IN_TRANSIT",
            });
          }
          if (to === "DELIVERED") {
            await notifyOrderEvent(tx, {
              orderId: id, userId: current.customerId, orderNumber: current.orderNumber, type: "SHIPMENT_DELIVERED",
            });
          }
          return tx.order.findUniqueOrThrow({
            where: { id },
            select: { id: true, orderNumber: true, status: true, totalCents: true },
          });
        }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 15000 });
        return Response.json({ order });
      } catch (error) {
        if (error instanceof HttpError || !isRetryable(error) || attempt >= 2) throw error;
        await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
      }
    }
  }

  /**
   * Cancel: the conditional write performs ownership validation at the same time (customers can cancel only their own orders).
   * CONFIRMED -> CANCELLED: restores stock and writes one positive release ledger entry per SKU in the same transaction (released only once).
   * CREATED -> CANCELLED: neither stock nor ledger entries change, and no fabricated release entry is written.
   */
  async function cancelOrder(id: string, actor: Actor): Promise<Response> {
    const role = actor.role as "CUSTOMER" | "STAFF";
    const ownerFilter = role === "CUSTOMER" ? { customerId: actor.id } : {};
    for (let attempt = 0; ; attempt++) {
      try {
        const order = await db.$transaction(async tx => {
          const claimedConfirmed = await tx.order.updateMany({
            where: { id, status: "CONFIRMED", ...ownerFilter },
            data: { status: "CANCELLED" },
          });
          let released = false;
          if (claimedConfirmed.count === 1) {
            released = true;
          } else if (role === "CUSTOMER") {
            const claimedCreated = await tx.order.updateMany({
              where: { id, status: "CREATED", ...ownerFilter },
              data: { status: "CANCELLED" },
            });
            if (claimedCreated.count === 0) await explainCancelFailure(tx, id, role, actor.id);
          } else {
            await explainCancelFailure(tx, id, role, actor.id);
          }

          const current = await tx.order.findUniqueOrThrow({ where: { id }, include: { items: true } });
          if (released) {
            const quantities = new Map<string, number>();
            for (const item of current.items) {
              quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
            }
            for (const [productId, quantity] of [...quantities.entries()].sort(([a], [b]) => a.localeCompare(b))) {
              await tx.product.update({ where: { id: productId }, data: { stock: { increment: quantity } } });
              await tx.inventoryLog.create({
                data: { productId, orderId: id, delta: quantity, reason: "ORDER_CANCEL_RELEASE", actorId: actor.id },
              });
            }
          }
          await notifyOrderEvent(tx, {
            orderId: id, userId: current.customerId, orderNumber: current.orderNumber, type: "ORDER_CANCELLED",
          });
          return tx.order.findUniqueOrThrow({
            where: { id },
            select: { id: true, orderNumber: true, status: true, totalCents: true },
          });
        }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 15000 });
        return Response.json({ order });
      } catch (error) {
        if (error instanceof HttpError || !isRetryable(error) || attempt >= 2) throw error;
        await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
      }
    }
  }

  /** Failure reasons: not found or not owned -> 404 (privacy-preserving); status not allowed -> 409. */
  async function explainCancelFailure(
    tx: Prisma.TransactionClient,
    id: string,
    role: "CUSTOMER" | "STAFF",
    actorId: string,
  ): Promise<never> {
    const existing = await tx.order.findUnique({ where: { id }, select: { customerId: true, status: true } });
    if (!existing) throw new HttpError(404, "ORDER_NOT_FOUND", "Order not found");
    if (role === "CUSTOMER" && existing.customerId !== actorId) {
      throw new HttpError(404, "ORDER_NOT_FOUND", "Order not found");
    }
    const reason = role === "STAFF"
      ? "staff can cancel confirmed (CONFIRMED) orders only"
      : "only your own orders that have not shipped yet can be cancelled (CREATED / CONFIRMED)";
    throw new HttpError(409, "INVALID_STATE_TRANSITION", `The current status ${existing.status} cannot be cancelled: ${reason}`);
  }

  /** GET /api/v1/orders/{internal id}/tracking */
  async function getTracking(req: Request, id: string): Promise<Response> {
    try {
      const { user } = await requireSession(db, req, { roles: ["CUSTOMER", "STAFF"] });
      return Response.json(await queryTracking(db, user, id));
    } catch (error) {
      return failure(error, "Tracking API unexpected failure");
    }
  }

  return { getOrder, listOrders, getOrderById, updateStatus, getTracking };
}

export function statusLabel(status: string): string {
  return STATUS_LABEL[status as OrderStatus] ?? status;
}
