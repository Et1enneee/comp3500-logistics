import { describe, expect, it } from "vitest";
import { canTransition } from "./constants";

describe("订单状态机", () => {
  const legal = [
    ["CREATED", "CONFIRMED"],
    ["CREATED", "CANCELLED"],
    ["CONFIRMED", "PICKING"],
    ["CONFIRMED", "CANCELLED"],
    ["PICKING", "SHIPPED"],
    ["SHIPPED", "IN_TRANSIT"],
    ["IN_TRANSIT", "DELIVERED"],
  ] as const;

  it.each(legal)("%s -> %s 是合法转移", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it("CREATED -> DELIVERED 非法", () => {
    expect(canTransition("CREATED", "DELIVERED")).toBe(false);
  });

  it("CANCELLED 是终态，不能再转", () => {
    expect(canTransition("CANCELLED", "CONFIRMED")).toBe(false);
  });
});
