import { describe, it, expect } from "vitest";
import type { OrderStatus } from "@prisma/client";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TRANSITIONS,
} from "@/config/order-statuses";

describe("Order status configuration", () => {
  it("every status in TRANSITIONS has a label", () => {
    for (const status of Object.keys(ORDER_STATUS_TRANSITIONS) as Array<keyof typeof ORDER_STATUS_TRANSITIONS>) {
      expect(ORDER_STATUS_LABELS[status as OrderStatus], `Missing label for status: ${status}`).toBeDefined();
    }
  });

  it("every transition target also has a label", () => {
    for (const targets of Object.values(ORDER_STATUS_TRANSITIONS) as OrderStatus[][]) {
      for (const target of targets) {
        expect(ORDER_STATUS_LABELS[target], `Missing label for target: ${target}`).toBeDefined();
      }
    }
  });

  it("CLOTURE has no transitions (terminal state)", () => {
    const transitions = (ORDER_STATUS_TRANSITIONS as Record<string, string[]>)["CLOTURE"] ?? [];
    expect(transitions).toHaveLength(0);
  });

  it("ANNULE has no transitions (terminal state)", () => {
    const transitions = (ORDER_STATUS_TRANSITIONS as Record<string, string[]>)["ANNULE"] ?? [];
    expect(transitions).toHaveLength(0);
  });

  it("DEMANDE (initial state) can transition to at least one state", () => {
    const transitions = (ORDER_STATUS_TRANSITIONS as Record<string, string[]>)["DEMANDE"] ?? [];
    expect(transitions.length).toBeGreaterThan(0);
  });
});
