import { prisma } from "@/lib/prisma";
import { createOrderHandlers } from "@/lib/order-api";
import { createOrderPost } from "@/lib/create-order";

export const dynamic = "force-dynamic";

const handlers = createOrderHandlers(prisma);
export const POST = createOrderPost(prisma);
// 带 orderNumber：按 ORD 精确查询；不带：分页列表（客户只看自己）。
export const GET = async (req: Request) => {
  const url = new URL(req.url);
  if (url.searchParams.has("orderNumber")) return handlers.getOrder(req);
  return handlers.listOrders(req);
};
