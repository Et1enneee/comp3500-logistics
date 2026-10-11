export const ORDER_STATUS = {
  CREATED: "CREATED",
  CONFIRMED: "CONFIRMED",
  PICKING: "PICKING",
  SHIPPED: "SHIPPED",
  IN_TRANSIT: "IN_TRANSIT",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

// 中文文案只存在这里，页面一律从这里取，不许在页面里硬编码
export const STATUS_LABEL: Record<OrderStatus, string> = {
  CREATED: "已创建",
  CONFIRMED: "已确认",
  PICKING: "拣货中",
  SHIPPED: "已发货",
  IN_TRANSIT: "在途",
  DELIVERED: "已签收",
  CANCELLED: "已取消",
};

// 合法转移表：from -> 可以去哪些状态
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  CREATED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PICKING", "CANCELLED"],
  PICKING: ["SHIPPED"],
  SHIPPED: ["IN_TRANSIT"],
  IN_TRANSIT: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
