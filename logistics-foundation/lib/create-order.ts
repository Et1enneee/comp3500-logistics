import type { PrismaClient } from "@prisma/client";
import { failure, HttpError, readJsonBody, requireSession } from "@/lib/http";

/**
 * POST /api/v1/orders
 * 身份来自服务端会话，不信任 POST 里的 email/customerId。
 * 创建只校验可用库存并写 CREATED，不扣库存、不写流水。
 */
export function createOrderPost(db: PrismaClient) {
  return async function POST(req: Request): Promise<Response> {
    try {
      const { user } = await requireSession(db, req, { roles: ["CUSTOMER"] });
      const body = await readJsonBody(req);
      const rawItems = body.items;
      if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 100) {
        throw new HttpError(400, "INVALID_ARGUMENT", "请提供 1–100 条有效商品明细");
      }
      // 兼容旧客户端字段：若仍传 email，必须与会话一致，不能替别人下单。
      if ("email" in body) {
        const email = body.email;
        if (typeof email !== "string" || email.trim().toLowerCase() !== user.email.toLowerCase()) {
          throw new HttpError(403, "FORBIDDEN", "请求中的客户邮箱与会话身份不一致");
        }
      }
      if ("customerId" in body && body.customerId !== user.id) {
        throw new HttpError(403, "FORBIDDEN", "请求中的客户 ID 与会话身份不一致");
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
          throw new HttpError(400, "INVALID_ARGUMENT", "每条明细须包含商品 SKU 和正整数数量");
        }
        const entry = item as { sku: string; quantity: number };
        const sku = entry.sku.trim();
        const total = (quantities.get(sku) ?? 0) + entry.quantity;
        if (!Number.isSafeInteger(total) || total > 2147483647) {
          throw new HttpError(400, "INVALID_ARGUMENT", "商品数量超出允许范围");
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
              if (!product) throw new HttpError(400, `SKU_NOT_FOUND_${sku}`, `商品 ${sku} 不存在`);
              if (product.stock < quantity) {
                throw new HttpError(
                  400,
                  `INSUFFICIENT_STOCK_${sku}`,
                  `${product.name}（${sku}）可用库存为 ${product.stock}，不足 ${quantity} 件。请减少数量后重试。`,
                );
              }
              totalCents += product.priceCents * quantity;
              if (!Number.isSafeInteger(totalCents) || totalCents > 2147483647) {
                throw new HttpError(400, "INVALID_ARGUMENT", "订单金额超出允许范围");
              }
              lines.push({ productId: product.id, quantity, unitPriceCents: product.priceCents });
            }
            // 保留既有 UTC 编号日历口径；每天 4 位序号。
            const today = new Date().toISOString().slice(0, 10).replaceAll("-", "");
            const prefix = `ORD-${today}-`;
            const latest = await tx.order.findFirst({
              where: { orderNumber: { startsWith: prefix } },
              orderBy: { orderNumber: "desc" },
              select: { orderNumber: true },
            });
            const sequence = latest ? Number(latest.orderNumber.slice(prefix.length)) + 1 : 1;
            if (!Number.isInteger(sequence) || sequence > 9999) {
              throw new HttpError(503, "TEMPORARILY_UNAVAILABLE", "当日订单编号不可分配，请联系负责人");
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
