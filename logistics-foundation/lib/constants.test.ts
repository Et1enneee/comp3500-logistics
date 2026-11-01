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

describe("取消规则（升级补充）", () => {
  it.each([
    ["CREATED", "CANCELLED"],
    ["CONFIRMED", "CANCELLED"],
  ] as const)("%s -> CANCELLED 合法", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    ["PICKING", "CANCELLED"],
    ["SHIPPED", "CANCELLED"],
    ["IN_TRANSIT", "CANCELLED"],
    ["DELIVERED", "CANCELLED"],
  ] as const)("%s -> CANCELLED 非法（拣货后不支持取消）", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it("DELIVERED 与 CANCELLED 是终态", () => {
    expect(canTransition("DELIVERED", "CANCELLED")).toBe(false);
    expect(canTransition("CANCELLED", "CREATED")).toBe(false);
  });
});
