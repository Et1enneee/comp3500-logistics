import { prisma } from "@/lib/prisma";
import { createNotificationHandlers } from "@/lib/notifications-api";

export const dynamic = "force-dynamic";

export const GET = createNotificationHandlers(prisma).unreadCount;
