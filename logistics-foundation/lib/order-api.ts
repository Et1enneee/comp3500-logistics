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

// 状态写入只走这一个端点；SHIPPED 必须走 POST /api/v1/shipments（需要承运商）。
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

/** 列表查询：客户仅本人；员工全部。页面与 API 共用这一处规则。 */
export async function queryOrderList(
  db: PrismaClient,
  actor: Actor,
  query: OrderListQuery,
): Promise<{ orders: ReturnType<typeof mapListRow>[]; page: number; pageSize: number; total: number; totalPages: number }> {
  if (actor.role === "ADMIN") throw new HttpError(403, "FORBIDDEN", "管理员不查看客户订单明细，仅使用聚合报表");
  const where: { customerId?: string; status?: OrderStatus } = {};
  if (actor.role === "CUSTOMER") where.customerId = actor.id;
  if (query.status) {
    if (!STATUS_VALUES.includes(query.status as OrderStatus)) {
      throw new HttpError(400, "INVALID_ARGUMENT", "状态筛选值不合法");
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

/** 详情查询：客户访问他人订单统一 404（不泄露存在性）。 */
export async function queryOrderDetail(
  db: PrismaClient,
  actor: Actor,
  id: string,
): Promise<OrderDetailRow> {
  if (actor.role === "ADMIN") throw new HttpError(403, "FORBIDDEN", "管理员不查看客户订单明细，仅使用聚合报表");
  if (!id?.trim()) throw new HttpError(400, "INVALID_ARGUMENT", "请提供订单内部 ID");
  const order = await db.order.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!order) throw new HttpError(404, "ORDER_NOT_FOUND", "订单不存在");
  if (actor.role === "CUSTOMER" && order.customerId !== actor.id) {
    throw new HttpError(404, "ORDER_NOT_FOUND", "订单不存在");
  }
  return order;
}

export async function queryOrderByNumber(
  db: PrismaClient,
  actor: Actor,
  orderNumber: string,
): Promise<OrderDetailRow> {
  if (actor.role === "ADMIN") throw new HttpError(403, "FORBIDDEN", "管理员不查看客户订单明细，仅使用聚合报表");
  if (!orderNumber.trim()) throw new HttpError(400, "INVALID_ARGUMENT", "请提供订单号");
  const order = await db.order.findUnique({ where: { orderNumber }, include: DETAIL_INCLUDE });
  if (!order) throw new HttpError(404, "ORDER_NOT_FOUND", "订单不存在");
  if (actor.role === "CUSTOMER" && order.customerId !== actor.id) {
    throw new HttpError(404, "ORDER_NOT_FOUND", "订单不存在");
  }
  return order;
}

export async function queryTracking(db: PrismaClient, actor: Actor, id: string) {
  if (actor.role === "ADMIN") throw new HttpError(403, "FORBIDDEN", "管理员不查看客户运单");
  if (!id?.trim()) throw new HttpError(400, "INVALID_ARGUMENT", "请提供订单内部 ID");
  const order = await db.order.findUnique({
    where: { id },
    include: { shipment: { include: { events: { orderBy: [{ at: "asc" }, { id: "asc" }] } } } },
  });
  if (!order) throw new HttpError(404, "ORDER_NOT_FOUND", "订单不存在");
  if (actor.role === "CUSTOMER" && order.customerId !== actor.id) {
    throw new HttpError(404, "ORDER_NOT_FOUND", "订单不存在");
  }
  if (!order.shipment) throw new HttpError(404, "SHIPMENT_NOT_FOUND", "订单尚未发货，暂无运单");
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
  /** GET /api/v1/orders?orderNumber=…（客户只能查自己的）。 */
  async function getOrder(req: Request): Promise<Response> {
    try {
      const { user } = await requireSession(db, req, { roles: ["CUSTOMER", "STAFF"] });
      const orderNumber = new URL(req.url).searchParams.get("orderNumber")?.trim() ?? "";
      if (!orderNumber) throw new HttpError(400, "INVALID_ARGUMENT", "请提供订单号");
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

  /** GET /api/v1/orders/{内部id} */
  async function getOrderById(req: Request, id: string): Promise<Response> {
    try {
      const { user } = await requireSession(db, req, { roles: ["CUSTOMER", "STAFF"] });
      return Response.json({ order: await queryOrderDetail(db, user, id) });
    } catch (error) {
      return failure(error, "Order detail unexpected failure");
    }
  }

  /**
   * PATCH /api/v1/orders/{内部id}/status
   * STAFF：确认 / 拣货 / 模拟揽收 / 模拟签收 / 取消 CONFIRMED
   * CUSTOMER：取消本人 CREATED 或 CONFIRMED
   */
  async function updateStatus(req: Request, id: string): Promise<Response> {
    try {
      const { user } = await requireSession(db, req, { roles: ["STAFF", "CUSTOMER"] });
      if (!id?.trim()) throw new HttpError(400, "INVALID_ARGUMENT", "请提供订单内部 ID");
      const body = await readJsonBody(req);
      if (!("to" in body)) throw new HttpError(400, "INVALID_ARGUMENT", "请求体须包含 to");
      const target = body.to;
      if (!TRANSITION_TARGETS.includes(target as TransitionTarget)) {
        const hint = target === "SHIPPED"
          ? "发货请使用 POST /api/v1/shipments（需要承运商）"
          : "to 仅支持 CONFIRMED / PICKING / IN_TRANSIT / DELIVERED / CANCELLED";
        throw new HttpError(400, "INVALID_ARGUMENT", hint);
      }
      const to = target as TransitionTarget;
      if (user.role === "CUSTOMER" && to !== "CANCELLED") {
        throw new HttpError(403, "FORBIDDEN", "客户只能取消自己的订单，不能执行员工履约操作");
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
          // 事务第一条是条件写：SQLite 串行化写者，原子抢占 CREATED -> CONFIRMED。
          const claimed = await tx.order.updateMany({
            where: { id, status: "CREATED" },
            data: { status: "CONFIRMED" },
          });
          if (claimed.count !== 1) {
            const exists = await tx.order.findUnique({ where: { id }, select: { id: true } });
            if (!exists) throw new HttpError(404, "ORDER_NOT_FOUND", "订单不存在");
            throw new HttpError(409, "INVALID_STATE_TRANSITION", "只有 CREATED 订单可以确认，且不能重复确认");
          }
          const current = await tx.order.findUnique({ where: { id }, include: { items: true } });
          if (!current || current.items.length === 0) {
            throw new HttpError(400, "INVALID_ARGUMENT", "订单缺少有效商品明细");
          }
          const quantities = new Map<string, number>();
          for (const item of current.items) {
            if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
              throw new HttpError(400, "INVALID_ARGUMENT", "订单商品数量必须为正整数");
            }
            const quantity = (quantities.get(item.productId) ?? 0) + item.quantity;
            if (!Number.isSafeInteger(quantity) || quantity > 2147483647) {
              throw new HttpError(400, "INVALID_ARGUMENT", "订单商品数量超出范围");
            }
            quantities.set(item.productId, quantity);
          }
          // 固定顺序扣减，降低跨订单锁顺序冲突。
          for (const [productId, quantity] of [...quantities.entries()].sort(([a], [b]) => a.localeCompare(b))) {
            const reserved = await tx.product.updateMany({
              where: { id: productId, stock: { gte: quantity } },
              data: { stock: { decrement: quantity } },
            });
            if (reserved.count !== 1) throw new HttpError(409, "INSUFFICIENT_STOCK", "库存不足，无法确认订单");
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
        // Prisma 在拒绝前已回滚；业务错误绝不重试，最多三次完整尝试。
        if (error instanceof HttpError || !isRetryable(error) || attempt >= 2) throw error;
        await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
      }
    }
  }

  async function advanceOrder(id: string, to: "PICKING" | "IN_TRANSIT" | "DELIVERED"): Promise<Response> {
    const expectedFrom = to === "PICKING" ? "CONFIRMED" : to === "IN_TRANSIT" ? "SHIPPED" : "IN_TRANSIT";
    const actionLabel = to === "PICKING" ? "开始拣货" : to === "IN_TRANSIT" ? "模拟揽收" : "模拟签收";
    for (let attempt = 0; ; attempt++) {
      try {
        const order = await db.$transaction(async tx => {
          const claimed = await tx.order.updateMany({
            where: { id, status: expectedFrom },
            data: { status: to },
          });
          if (claimed.count !== 1) {
            const exists = await tx.order.findUnique({ where: { id }, select: { id: true } });
            if (!exists) throw new HttpError(404, "ORDER_NOT_FOUND", "订单不存在");
            throw new HttpError(409, "INVALID_STATE_TRANSITION", `只有 ${expectedFrom} 订单可以${actionLabel}，且不能重复操作`);
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
            if (!shipment) throw new HttpError(409, "SHIPMENT_NOT_FOUND", "订单尚无运单，无法更新物流状态");
            await tx.shipment.update({
              where: { orderId: id },
              data: { status: to, ...(to === "DELIVERED" ? { deliveredAt: new Date() } : {}) },
            });
            await tx.trackingEvent.create({
              data: {
                shipmentId: shipment.id,
                location: to === "IN_TRANSIT" ? "揽收网点" : "收件地址",
                description: to === "IN_TRANSIT" ? `承运商 ${shipment.carrier} 已揽收` : "收件人已签收",
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
   * 取消：条件写同时完成归属校验（客户只能取消自己的单）。
   * CONFIRMED → CANCELLED：同一事务回补库存并每 SKU 一条正释放流水（只释放一次）。
   * CREATED → CANCELLED：库存与流水都不变，也不写伪造释放流水。
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

  /** 失败原因：不存在或不属于本人 → 404（隐匿）；状态不允许 → 409。 */
  async function explainCancelFailure(
    tx: Prisma.TransactionClient,
    id: string,
    role: "CUSTOMER" | "STAFF",
    actorId: string,
  ): Promise<never> {
    const existing = await tx.order.findUnique({ where: { id }, select: { customerId: true, status: true } });
    if (!existing) throw new HttpError(404, "ORDER_NOT_FOUND", "订单不存在");
    if (role === "CUSTOMER" && existing.customerId !== actorId) {
      throw new HttpError(404, "ORDER_NOT_FOUND", "订单不存在");
    }
    const reason = role === "STAFF"
      ? "员工只能取消已确认（CONFIRMED）订单"
      : "只能取消本人尚未发货的订单（CREATED / CONFIRMED）";
    throw new HttpError(409, "INVALID_STATE_TRANSITION", `当前状态 ${existing.status} 不能取消：${reason}`);
  }

  /** GET /api/v1/orders/{内部id}/tracking */
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
