import { prisma } from "@/lib/prisma";
import { createOrderHandlers } from "@/lib/order-api";

export const dynamic = "force-dynamic";

const { getTracking } = createOrderHandlers(prisma);
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return getTracking(req, id);
}
