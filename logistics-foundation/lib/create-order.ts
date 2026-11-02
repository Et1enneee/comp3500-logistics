import type { PrismaClient } from "@prisma/client";
import { failure, HttpError, readJsonBody, requireSession } from "@/lib/http";

/**
 * POST /api/v1/orders
 * Identity comes from the server-side session; email/customerId in the POST body is never trusted.
 * Creation only validates available stock and writes CREATED — no stock deduction, no ledger entry.
 */
export function createOrderPost(db: PrismaClient) {
  return async function POST(req: Request): Promise<Response> {
    try {
      const { user } = await requireSession(db, req, { roles: ["CUSTOMER"] });
      const body = await readJsonBody(req);
      const rawItems = body.items;
      if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 100) {
        throw new HttpError(400, "INVALID_ARGUMENT", "Please provide 1–100 valid order item lines");
      }
      // Legacy client compatibility: if email is still sent, it must match the session — no ordering on behalf of others.
      if ("email" in body) {
        const email = body.email;
        if (typeof email !== "string" || email.trim().toLowerCase() !== user.email.toLowerCase()) {
          throw new HttpError(403, "FORBIDDEN", "The customer email in the request does not match the session identity");
        }
      }
      if ("customerId" in body && body.customerId !== user.id) {
        throw new HttpError(403, "FORBIDDEN", "The customer ID in the request does not match the session identity");
      }

      const quantities = new Map<string, number>();
      for (const item of rawItems) {
        if (
          !item || typeof item !== "object" || Array.isArray(item) ||
          typeof (item as { sku?: unknown }).sku !== "string" ||
          !(item as { sku: string }).sku.trim() ||
          !Number.isSafeInteger((item as { quantity?: unknown }).quantity) ||
          (item as { quantity: number }).quantity <= 0
        ) {
          throw new HttpError(400, "INVALID_ARGUMENT", "Each item line must contain a product SKU and a positive integer quantity");
        }
        const entry = item as { sku: string; quantity: number };
        const sku = entry.sku.trim();
        const total = (quantities.get(sku) ?? 0) + entry.quantity;
        if (!Number.isSafeInteger(total) || total > 2147483647) {
          throw new HttpError(400, "INVALID_ARGUMENT", "The product quantity is out of the allowed range");
        }
        quantities.set(sku, total);
      }

      for (let attempt = 0; ; attempt++) {
        try {
          const order = await db.$transaction(async tx => {
            const products = await tx.product.findMany({ where: { sku: { in: [...quantities.keys()] } } });
            let totalCents = 0;
            const lines: { productId: string; quantity: number; unitPriceCents: number }[] = [];
            for (const [sku, quantity] of quantities) {
              const product = products.find(candidate => candidate.sku === sku);
              if (!product) throw new HttpError(400, `SKU_NOT_FOUND_${sku}`, `Product ${sku} does not exist`);
              if (product.stock < quantity) {
                throw new HttpError(
                  400,
                  `INSUFFICIENT_STOCK_${sku}`,
                  `${product.name} (${sku}) has only ${product.stock} available stock, which is less than ${quantity}. Please reduce the quantity and try again.`,
                );
              }
              totalCents += product.priceCents * quantity;
              if (!Number.isSafeInteger(totalCents) || totalCents > 2147483647) {
                throw new HttpError(400, "INVALID_ARGUMENT", "The order amount is out of the allowed range");
              }
              lines.push({ productId: product.id, quantity, unitPriceCents: product.priceCents });
            }
            // Keep the existing UTC calendar-day numbering; 4-digit sequence per day.
            const today = new Date().toISOString().slice(0, 10).replaceAll("-", "");
            const prefix = `ORD-${today}-`;
            const latest = await tx.order.findFirst({
              where: { orderNumber: { startsWith: prefix } },
              orderBy: { orderNumber: "desc" },
              select: { orderNumber: true },
            });
            const sequence = latest ? Number(latest.orderNumber.slice(prefix.length)) + 1 : 1;
            if (!Number.isInteger(sequence) || sequence > 9999) {
              throw new HttpError(503, "TEMPORARILY_UNAVAILABLE", "No order number can be allocated for today; please contact the project owner");
            }
            return tx.order.create({
              data: {
                orderNumber: prefix + String(sequence).padStart(4, "0"),
                customerId: user.id,
                status: "CREATED",
                totalCents,
                items: { create: lines },
              },
              include: { items: true },
            });
          }, { maxWait: 5000, timeout: 15000 });
          return Response.json({ order }, { status: 201 });
        } catch (error) {
          const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
          if (error instanceof HttpError || (!["P2002", "P2034", "P1008"].includes(code) || attempt >= 2)) throw error;
          await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
        }
      }
    } catch (error) {
      return failure(error, "Create order failed");
    }
  };
}
