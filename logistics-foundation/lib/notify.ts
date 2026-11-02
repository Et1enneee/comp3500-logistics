import type { Prisma } from "@prisma/client";
import { formatGmt8, TIMEZONE_LABEL } from "@/lib/time";

export const NOTIFICATION_TYPES = {
  ORDER_CONFIRMED: "confirmed",
  ORDER_CANCELLED: "cancelled",
  SHIPMENT_SHIPPED: "shipped",
  SHIPMENT_IN_TRANSIT: "picked up",
  SHIPMENT_DELIVERED: "delivered",
} as const;

export type NotificationType = keyof typeof NOTIFICATION_TYPES;

/**
 * Writes an in-app notification inside the business transaction: a failure rolls everything back,
 * so "order succeeded, notification pretended to succeed" can never happen.
 * (orderId, type) is unique: duplicate/concurrent requests produce at most one row.
 */
export async function notifyOrderEvent(
  tx: Prisma.TransactionClient,
  params: { orderId: string; userId: string; orderNumber: string; type: NotificationType; at?: Date },
): Promise<void> {
  const at = params.at ?? new Date();
  const label = NOTIFICATION_TYPES[params.type];
  const content = `Order ${params.orderNumber} ${label} (${formatGmt8(at)} ${TIMEZONE_LABEL})`;
  await tx.notification.upsert({
    where: { orderId_type: { orderId: params.orderId, type: params.type } },
    update: {},
    create: {
      userId: params.userId,
      orderId: params.orderId,
      type: params.type,
      content,
      createdAt: at,
    },
  });
}
