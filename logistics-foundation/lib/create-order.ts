import type { PrismaClient } from "@prisma/client";
class CreationError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}
export function createOrderPost(db: PrismaClient) {
  return async function POST(req: Request): Promise<Response> {
    let body: unknown;
    try { body = await req.json(); } catch { return errorResponse(400,"INVALID_ARGUMENT","请求体必须是有效 JSON。"); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return errorResponse(400,"INVALID_ARGUMENT","请求内容格式不正确。");
    const {email,items} = body as {email?:unknown;items?:unknown};
    if (typeof email !== "string" || !email.trim() || !Array.isArray(items) || !items.length || items.length > 100) return errorResponse(400,"INVALID_ARGUMENT","请提供客户邮箱和 1–100 条有效商品明细。");
    const quantities = new Map<string,number>();
    for (const item of items) {
      if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.sku !== "string" || !item.sku.trim() || !Number.isSafeInteger(item.quantity) || item.quantity <= 0) return errorResponse(400,"INVALID_ARGUMENT","每条明细须包含商品 SKU 和正整数数量。");
      const sku = item.sku.trim();
      const total = (quantities.get(sku) ?? 0) + item.quantity;
      if (!Number.isSafeInteger(total) || total > 2147483647) return errorResponse(400,"INVALID_ARGUMENT","商品数量超出允许范围。");
      quantities.set(sku,total);
    }
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          const order = await db.$transaction(async tx => {
            const customer = await tx.user.findUnique({where:{email:email.trim()},select:{id:true,role:true}});
            if (!customer) throw new CreationError(400,"CUSTOMER_NOT_FOUND","演示客户不存在，请检查初始化数据。");
            if (customer.role !== "CUSTOMER") throw new CreationError(403,"FORBIDDEN","请使用 CUSTOMER 演示账号下单。");
            const products = await tx.product.findMany({where:{sku:{in:[...quantities.keys()]}}});
            let totalCents = 0;
            const lines = [];
            for (const [sku,quantity] of quantities) {
              const p = products.find(p=>p.sku===sku);
              if (!p) throw new CreationError(400,`SKU_NOT_FOUND_${sku}`,`商品 ${sku} 不存在。`);
              if (p.stock < quantity) throw new CreationError(400,`INSUFFICIENT_STOCK_${sku}`,`${p.name}（${sku}）可用库存为 ${p.stock}，不足 ${quantity} 件。请减少数量后重试。`);
              totalCents += p.priceCents * quantity;
              if (!Number.isSafeInteger(totalCents) || totalCents > 2147483647) throw new CreationError(400,"INVALID_ARGUMENT","订单金额超出允许范围。");
              lines.push({productId:p.id,quantity,unitPriceCents:p.priceCents});
            }
            // Preserve the existing UTC calendar-day convention; 4-digit daily sequence.
            const today = new Date().toISOString().slice(0,10).replaceAll("-","");
            const prefix = `ORD-${today}-`;
            const latest = await tx.order.findFirst({where:{orderNumber:{startsWith:prefix}},orderBy:{orderNumber:"desc"},select:{orderNumber:true}});
            const sequence = latest ? Number(latest.orderNumber.slice(prefix.length)) + 1 : 1;
            if (!Number.isInteger(sequence) || sequence > 9999) throw new CreationError(503,"TEMPORARILY_UNAVAILABLE","当日订单编号不可分配，请联系负责人。");
            return tx.order.create({data:{orderNumber:prefix+String(sequence).padStart(4,"0"),customerId:customer.id,status:"CREATED",totalCents,items:{create:lines}},include:{items:true}});
          }, {maxWait:5000,timeout:15000});
          return Response.json({order},{status:201});
        } catch (error) {
          // Uniqueness conflicts or transient SQLite contention: retry the whole transaction.
          const code = error && typeof error==="object" && "code" in error ? error.code : "";
          if (!["P2002","P2034","P1008"].includes(String(code)) || attempt >= 2) throw error;
          await new Promise(resolve=>setTimeout(resolve,50*(attempt+1)));
        }
      }
    } catch (error) {
      if (error instanceof CreationError) return errorResponse(error.status,error.code,error.message);
      const code = error && typeof error==="object" && "code" in error ? error.code : "";
      if (["P2002","P2034","P1008"].includes(String(code))) return errorResponse(503,"TEMPORARILY_UNAVAILABLE","数据库暂时繁忙，请稍后重试。");
      console.error("Create order failed",error instanceof Error ? error.name : "UnknownError");
      return errorResponse(500,"INTERNAL_ERROR","服务器处理失败，请稍后重试。");
    }
  };
}
