import { prisma } from "@/lib/prisma";
import { createOrderHandlers } from "@/lib/order-api";
const { getTracking } = createOrderHandlers(prisma);
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return getTracking(req, id);
}
