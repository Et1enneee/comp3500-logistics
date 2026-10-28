import { prisma } from "@/lib/prisma";
import { createOrderHandlers } from "@/lib/order-api";
const { confirmOrder } = createOrderHandlers(prisma);
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return confirmOrder(req, id);
}
