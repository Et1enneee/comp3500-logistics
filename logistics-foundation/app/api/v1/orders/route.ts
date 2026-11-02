import { prisma } from "@/lib/prisma";
import { createOrderHandlers } from "@/lib/order-api";
import { createOrderPost } from "@/lib/create-order";

export const dynamic = "force-dynamic";

const handlers = createOrderHandlers(prisma);
export const POST = createOrderPost(prisma);
// With orderNumber: exact ORD lookup; without: paginated list (customers see only their own).
export const GET = async (req: Request) => {
  const url = new URL(req.url);
  if (url.searchParams.has("orderNumber")) return handlers.getOrder(req);
  return handlers.listOrders(req);
};
