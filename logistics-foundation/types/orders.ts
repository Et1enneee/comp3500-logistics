import type { OrderStatus } from "@/lib/constants";
export type OrderApiErrorCode =
  | `SKU_NOT_FOUND_${string}` | `INSUFFICIENT_STOCK_${string}`
  | "INVALID_ARGUMENT" | "ORDER_NOT_FOUND" | "INSUFFICIENT_STOCK"
  | "INVALID_STATE_TRANSITION" | "UNAUTHENTICATED" | "FORBIDDEN"
  | "SHIPMENT_EXISTS" | "SHIPMENT_NOT_FOUND"
  | "TEMPORARILY_UNAVAILABLE" | "INTERNAL_ERROR"
  | "CSRF_INVALID" | "RATE_LIMITED" | "PRODUCT_NOT_FOUND" | "NOTIFICATION_NOT_FOUND";
export interface OrderApiError { error: { code: OrderApiErrorCode; message: string } }
export interface OrderSummary {
  id: string; orderNumber: string; status: OrderStatus; totalCents: number;
}
export interface OrderItemDto {
  id: string; orderId: string; productId: string;
  quantity: number; unitPriceCents: number;
  product: { sku: string; name: string };
}
export interface ShipmentSummaryDto {
  trackingNumber: string; carrier: string; status: string;
  shippedAt: string | null; deliveredAt: string | null;
}
export interface OrderDetail extends OrderSummary {
  customerId: string; createdAt: string; updatedAt: string;
  items: OrderItemDto[];
  customer: { id: string; email: string; name: string };
  shipment?: ShipmentSummaryDto | null;
}
export interface GetOrderResponse { order: OrderDetail }
export type StatusUpdateTarget = "CONFIRMED" | "PICKING" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED";
export interface StatusUpdateRequest { to: StatusUpdateTarget }
export interface ConfirmOrderResponse { order: OrderSummary }

export interface OrderListItem {
  id: string; orderNumber: string; status: OrderStatus; totalCents: number;
  createdAt: string; customer: { name: string; email: string };
  itemCount: number; trackingNumber: string | null;
}
export interface OrderListResponse {
  orders: OrderListItem[];
  page: number; pageSize: number; total: number; totalPages: number;
}

export interface ShipmentDto {
  id: string; trackingNumber: string; carrier: string; status: string; shippedAt: string;
}
export interface ShipmentCreateResponse { shipment: ShipmentDto; order: OrderSummary }
export interface TrackingEventDto { at: string; location: string; description: string }
export interface TrackingResponse {
  trackingNumber: string; carrier: string; status: string; events: TrackingEventDto[];
}

export interface SessionUserDto { id: string; email: string; name: string; role: "CUSTOMER" | "STAFF" | "ADMIN" }
export interface MeResponse { user: SessionUserDto; csrfToken: string; expiresAt: string }

export interface InventoryItem {
  id: string; sku: string; name: string; priceCents: number;
  stock: number; lowStockThreshold: number; isLowStock: boolean; updatedAt: string;
}
export interface InventoryListResponse {
  products: InventoryItem[];
  page: number; pageSize: number; total: number; totalPages: number; lowStockCount: number;
}
export interface InventoryLogItem {
  id: string; delta: number; reason: string; createdAt: string;
  product: { sku: string; name: string };
  orderNumber: string | null;
  actor: { name: string; email: string } | null;
}
export interface InventoryLogsResponse {
  logs: InventoryLogItem[];
  page: number; pageSize: number; total: number; totalPages: number;
}

export interface NotificationItem {
  id: string; type: string; content: string; read: boolean; createdAt: string;
  orderNumber: string | null; orderStatus: OrderStatus | null;
}
export interface NotificationListResponse {
  notifications: NotificationItem[];
  page: number; pageSize: number; total: number; totalPages: number; unreadCount: number;
}

export interface ReportOverviewResponse {
  range: { from: string; to: string; timezone: string; startUtc: string; endUtcExclusive: string };
  orders: {
    count: number;
    byStatus: Record<string, number>;
    nonCancelledAmountCents: number;
    deliveredAmountCents: number;
  };
  inventory: { lowStockSkuCount: number; note: string; timezone: string };
  daily: { date: string; count: number; cancelledCount: number }[];
}
