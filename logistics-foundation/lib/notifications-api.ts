import type { PrismaClient } from "@prisma/client";
import { failure, HttpError, requireSession } from "@/lib/http";
import { parseNotificationParams } from "@/lib/query-params";

export interface NotificationQuery {
  page: number;
  pageSize: number;
  unreadOnly: boolean;
}

/** In-app notification query: returns only the user's own records; shared by the page and the API. */
export async function queryNotifications(db: PrismaClient, userId: string, query: NotificationQuery) {
  const where = { userId, ...(query.unreadOnly ? { read: false } : {}) };
  const skip = (query.page - 1) * query.pageSize;
  const [rows, total, unreadCount] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: query.pageSize,
      include: { order: { select: { orderNumber: true, status: true } } },
    }),
    db.notification.count({ where }),
    db.notification.count({ where: { userId, read: false } }),
  ]);
  return {
    notifications: rows.map(row => ({
      id: row.id,
      type: row.type,
      content: row.content,
      read: row.read,
      createdAt: row.createdAt,
      orderNumber: row.order?.orderNumber ?? null,
      orderStatus: row.order?.status ?? null,
    })),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    unreadCount,
  };
}

export function createNotificationHandlers(db: PrismaClient) {
  async function list(req: Request): Promise<Response> {
    try {
      const { user } = await requireSession(db, req, { roles: ["CUSTOMER"] });
      const url = new URL(req.url);
      return Response.json(await queryNotifications(db, user.id, parseNotificationParams(url.searchParams)));
    } catch (error) {
      return failure(error, "Notification list unexpected failure");
    }
  }

  async function unreadCount(req: Request): Promise<Response> {
    try {
      const { user } = await requireSession(db, req, { roles: ["CUSTOMER"] });
      const count = await db.notification.count({ where: { userId: user.id, read: false } });
      return Response.json({ unreadCount: count });
    } catch (error) {
      return failure(error, "Notification unread unexpected failure");
    }
  }

  /** POST /api/v1/notifications/{id}/read: someone else's notification and a missing one both return 404. */
  async function markRead(req: Request, id: string): Promise<Response> {
    try {
      const { user } = await requireSession(db, req, { roles: ["CUSTOMER"] });
      if (!id?.trim()) throw new HttpError(400, "INVALID_ARGUMENT", "Please provide the notification ID");
      const updated = await db.notification.updateMany({ where: { id, userId: user.id }, data: { read: true } });
      if (updated.count !== 1) throw new HttpError(404, "NOTIFICATION_NOT_FOUND", "Notification not found");
      const unreadCount = await db.notification.count({ where: { userId: user.id, read: false } });
      return Response.json({ ok: true, unreadCount });
    } catch (error) {
      return failure(error, "Notification read unexpected failure");
    }
  }

  return { list, unreadCount, markRead };
}
