import { prisma } from "@/lib/prisma";
import { createDriverHandlers } from "@/lib/driver-api";

export const dynamic = "force-dynamic";
const { assign } = createDriverHandlers(prisma);
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return assign(req, id);
}
