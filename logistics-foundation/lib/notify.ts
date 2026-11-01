import type { Prisma } from "@prisma/client";
import { formatGmt8, TIMEZONE_LABEL } from "@/lib/time";

export const NOTIFICATION_TYPES = {
  ORDER_CONFIRMED: "已确认",
  ORDER_CANCELLED: "已取消",
  SHIPMENT_SHIPPED: "已发货",
  SHIPMENT_IN_TRANSIT: "已揽收",
  SHIPMENT_DELIVERED: "已签收",
} as const;

export type NotificationType = keyof typeof NOTIFICATION_TYPES;

/**
 * 在业务事务内写站内通知：失败整体回滚，不会出现“订单成功、通知假装成功”。
 * (orderId, type) 唯一：重复/并发请求最多一条。
 */
export async function notifyOrderEvent(
  tx: Prisma.TransactionClient,
  params: { orderId: string; userId: string; orderNumber: string; type: NotificationType; at?: Date },
): Promise<void> {
  const at = params.at ?? new Date();
  const label = NOTIFICATION_TYPES[params.type];
  const content = `订单 ${params.orderNumber} ${label}（${formatGmt8(at)} ${TIMEZONE_LABEL}）`;
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
