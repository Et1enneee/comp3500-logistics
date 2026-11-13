import { prisma } from "@/lib/prisma";
import { createOrderHandlers } from "@/lib/order-api";

export const dynamic = "force-dynamic";

const { updateStatus } = createOrderHandlers(prisma);
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return updateStatus(req, id);
}
