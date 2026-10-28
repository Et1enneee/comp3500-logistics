import type { OrderStatus } from "@/lib/constants";
export type OrderApiErrorCode =
  | "INVALID_ARGUMENT" | "ORDER_NOT_FOUND" | "INSUFFICIENT_STOCK"
  | "INVALID_STATE_TRANSITION" | "UNAUTHENTICATED" | "FORBIDDEN"
  | "SHIPMENT_EXISTS" | "SHIPMENT_NOT_FOUND"
  | "TEMPORARILY_UNAVAILABLE" | "INTERNAL_ERROR";
export interface OrderApiError { error: { code: OrderApiErrorCode; message: string } }
export interface OrderSummary {
  id: string; orderNumber: string; status: OrderStatus; totalCents: number;
}
export interface OrderItemDto {
  id: string; orderId: string; productId: string;
  quantity: number; unitPriceCents: number;
  product: { sku: string; name: string };
}
export interface OrderDetail extends OrderSummary {
  customerId: string; createdAt: string; updatedAt: string;
  items: OrderItemDto[];
  customer: { id: string; email: string; name: string };
}
export interface GetOrderResponse { order: OrderDetail }
export type StatusUpdateTarget = "CONFIRMED" | "PICKING" | "IN_TRANSIT" | "DELIVERED";
export interface StatusUpdateRequest { to: StatusUpdateTarget }
export interface ConfirmOrderResponse { order: OrderSummary }

export interface ShipmentDto {
  id: string; trackingNumber: string; carrier: string; status: string; shippedAt: string;
}
export interface ShipmentCreateResponse { shipment: ShipmentDto; order: OrderSummary }
export interface TrackingEventDto { at: string; location: string; description: string }
export interface TrackingResponse {
  trackingNumber: string; carrier: string; status: string; events: TrackingEventDto[];
}
