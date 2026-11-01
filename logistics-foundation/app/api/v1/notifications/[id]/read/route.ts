import { prisma } from "@/lib/prisma";
import { createNotificationHandlers } from "@/lib/notifications-api";

export const dynamic = "force-dynamic";

const { markRead } = createNotificationHandlers(prisma);
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return markRead(req, id);
}
