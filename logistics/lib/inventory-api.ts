import type { PrismaClient } from "@prisma/client";
import { failure, HttpError, readJsonBody, requireSession } from "@/lib/http";
import { parseInventoryParams, parseInventoryLogParams } from "@/lib/query-params";

const MAX_QUANTITY = 1_000_000;

export interface InventoryRow {
  id: string;
  sku: string;
  name: string;
  priceCents: number;
  stock: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  updatedAt: Date;
}

export interface InventoryQuery {
  page: number;
  pageSize: number;
  lowStockOnly: boolean;
  sku?: string;
}

/** Stock always means "available stock"; an alert requires strictly stock < threshold (equal to the threshold does not alert). */
export async function queryInventory(db: PrismaClient, query: InventoryQuery) {
  // Prisma cannot compare two columns, so rows are read and then filtered by stock < lowStockThreshold.
  const all = await db.product.findMany({
    where: query.sku ? { sku: query.sku } : undefined,
    orderBy: { sku: "asc" },
  });
  const rows: InventoryRow[] = all.map(product => ({
    id: product.id,
    sku: product.sku,
    name: product.name,
    priceCents: product.priceCents,
    stock: product.stock,
    lowStockThreshold: product.lowStockThreshold,
    isLowStock: product.stock < product.lowStockThreshold,
    updatedAt: product.updatedAt,
  }));
  const filtered = query.lowStockOnly ? rows.filter(row => row.isLowStock) : rows;
  const skip = (query.page - 1) * query.pageSize;
  return {
    products: filtered.slice(skip, skip + query.pageSize),
    page: query.page,
    pageSize: query.pageSize,
    total: filtered.length,
    totalPages: Math.max(1, Math.ceil(filtered.length / query.pageSize)),
    lowStockCount: rows.filter(row => row.isLowStock).length,
  };
}

export interface InventoryLogQuery {
  page: number;
  pageSize: number;
  sku?: string;
  orderNumber?: string;
}

export async function queryInventoryLogs(db: PrismaClient, query: InventoryLogQuery) {
  let orderId: string | undefined;
  if (query.orderNumber) {
    const order = await db.order.findUnique({ where: { orderNumber: query.orderNumber }, select: { id: true } });
    if (!order) {
      return { logs: [], page: 1, pageSize: query.pageSize, total: 0, totalPages: 1 };
    }
    orderId = order.id;
  }
  const where = {
    ...(query.sku ? { product: { sku: query.sku } } : {}),
    ...(orderId ? { orderId } : {}),
  };
  const skip = (query.page - 1) * query.pageSize;
  const [rows, total] = await Promise.all([
    db.inventoryLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: query.pageSize,
      include: {
        product: { select: { sku: true, name: true } },
        actor: { select: { name: true, email: true, role: true } },
      },
    }),
    db.inventoryLog.count({ where }),
  ]);
  const orders = await db.order.findMany({
    where: { id: { in: rows.map(row => row.orderId).filter((value): value is string => Boolean(value)) } },
    select: { id: true, orderNumber: true },
  });
  const orderNumberById = new Map(orders.map(order => [order.id, order.orderNumber]));
  return {
    logs: rows.map(row => ({
      id: row.id,
      delta: row.delta,
      reason: row.reason,
      createdAt: row.createdAt,
      product: row.product,
      orderNumber: row.orderId ? orderNumberById.get(row.orderId) ?? null : null,
      actor: row.actor ? (row.actor.role === "CUSTOMER"
        ? { name: "Customer", email: null }
        : { name: row.actor.name, email: row.actor.email }) : null,
    })),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export function createInventoryHandlers(db: PrismaClient) {
  /** GET /api/v1/inventory?lowStock=1&sku=&page=&pageSize= */
  async function listInventory(req: Request): Promise<Response> {
    try {
      await requireSession(db, req, { roles: ["STAFF", "ADMIN"] });
      const url = new URL(req.url);
      return Response.json(await queryInventory(db, parseInventoryParams(url.searchParams)));
    } catch (error) {
      return failure(error, "Inventory list unexpected failure");
    }
  }

  /** GET /api/v1/inventory/low-stock: data source for the standalone alert panel. */
  async function listLowStock(req: Request): Promise<Response> {
    try {
      await requireSession(db, req, { roles: ["STAFF", "ADMIN"] });
      const products = await db.product.findMany({ orderBy: { sku: "asc" } });
      const low = products
        .filter(product => product.stock < product.lowStockThreshold)
        .map(product => ({
          id: product.id, sku: product.sku, name: product.name,
          stock: product.stock, lowStockThreshold: product.lowStockThreshold,
        }));
      return Response.json({ products: low, count: low.length });
    } catch (error) {
      return failure(error, "Low stock unexpected failure");
    }
  }

  /** POST /api/v1/inventory/{productId}/replenish { quantity }: increments only, never overwrites. */
  async function replenish(req: Request, productId: string): Promise<Response> {
    try {
      const { user } = await requireSession(db, req, { roles: ["STAFF"] });
      if (!productId?.trim()) throw new HttpError(400, "INVALID_ARGUMENT", "Please provide the product ID");
      const body = await readJsonBody(req);
      const quantity = body.quantity;
      if (!Number.isSafeInteger(quantity) || (quantity as number) <= 0) {
        throw new HttpError(400, "INVALID_ARGUMENT", "The replenishment quantity must be a positive integer");
      }
      if ((quantity as number) > MAX_QUANTITY) {
        throw new HttpError(400, "INVALID_ARGUMENT", `A single replenishment must not exceed ${MAX_QUANTITY} units`);
      }
      const amount = quantity as number;
      const result = await db.$transaction(async tx => {
        const existing = await tx.product.findUnique({ where: { id: productId } });
        if (!existing) throw new HttpError(404, "PRODUCT_NOT_FOUND", "Product not found");
        if (existing.stock + amount > 2147483647) {
          throw new HttpError(400, "INVALID_ARGUMENT", "Stock is out of the allowed range");
        }
        const product = await tx.product.update({
          where: { id: productId },
          data: { stock: { increment: amount } },
        });
        const log = await tx.inventoryLog.create({
          data: { productId, delta: amount, reason: "STOCK_REPLENISH", actorId: user.id },
          select: { id: true, delta: true, reason: true, createdAt: true },
        });
        return { product, log };
      }, { maxWait: 5000, timeout: 15000 });
      return Response.json({
        product: {
          id: result.product.id, sku: result.product.sku, name: result.product.name,
          stock: result.product.stock, lowStockThreshold: result.product.lowStockThreshold,
          isLowStock: result.product.stock < result.product.lowStockThreshold,
        },
        log: { ...result.log, actor: { name: user.name, email: user.email } },
      }, { status: 201 });
    } catch (error) {
      return failure(error, "Replenish unexpected failure");
    }
  }

  /** GET /api/v1/inventory/logs?sku=&orderNumber=&page=&pageSize= */
  async function listLogs(req: Request): Promise<Response> {
    try {
      await requireSession(db, req, { roles: ["STAFF", "ADMIN"] });
      const url = new URL(req.url);
      return Response.json(await queryInventoryLogs(db, parseInventoryLogParams(url.searchParams)));
    } catch (error) {
      return failure(error, "Inventory logs unexpected failure");
    }
  }

  return { listInventory, listLowStock, replenish, listLogs };
}
