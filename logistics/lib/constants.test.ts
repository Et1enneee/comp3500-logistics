import { describe, expect, it } from "vitest";
import { canTransition } from "./constants";

describe("Order state machine", () => {
  const legal = [
    ["CREATED", "CONFIRMED"],
    ["CREATED", "CANCELLED"],
    ["CONFIRMED", "PICKING"],
    ["CONFIRMED", "CANCELLED"],
    ["PICKING", "SHIPPED"],
    ["SHIPPED", "IN_TRANSIT"],
    ["IN_TRANSIT", "DELIVERED"],
  ] as const;

  it.each(legal)("%s -> %s is a legal transition", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it("CREATED -> DELIVERED is illegal", () => {
    expect(canTransition("CREATED", "DELIVERED")).toBe(false);
  });

  it("CANCELLED is a final state with no further transitions", () => {
    expect(canTransition("CANCELLED", "CONFIRMED")).toBe(false);
  });
});

describe("Cancellation rules (upgrade supplement)", () => {
  it.each([
    ["CREATED", "CANCELLED"],
    ["CONFIRMED", "CANCELLED"],
  ] as const)("%s -> CANCELLED is legal", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    ["PICKING", "CANCELLED"],
    ["SHIPPED", "CANCELLED"],
    ["IN_TRANSIT", "CANCELLED"],
    ["DELIVERED", "CANCELLED"],
  ] as const)("%s -> CANCELLED is illegal (no cancellation once picking has started)", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it("DELIVERED and CANCELLED are final states", () => {
    expect(canTransition("DELIVERED", "CANCELLED")).toBe(false);
    expect(canTransition("CANCELLED", "CREATED")).toBe(false);
  });
});
