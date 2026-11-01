import { prisma } from "@/lib/prisma";
import { createInventoryHandlers } from "@/lib/inventory-api";

export const dynamic = "force-dynamic";

const { replenish } = createInventoryHandlers(prisma);
export async function POST(req: Request, context: { params: Promise<{ productId: string }> }) {
  const { productId } = await context.params;
  return replenish(req, productId);
}
