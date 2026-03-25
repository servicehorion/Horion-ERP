import { describe, it, expect } from "vitest";
import { hasPermission, getRolePermissions } from "@/lib/permissions";

describe("hasPermission", () => {
  it("ADMIN can do everything", () => {
    expect(hasPermission("ADMIN", "order.create")).toBe(true);
    expect(hasPermission("ADMIN", "finance.manage")).toBe(true);
    expect(hasPermission("ADMIN", "crm.manage")).toBe(true);
    expect(hasPermission("ADMIN", "ai.manage")).toBe(true);
  });

  it("VIEWER cannot access CRM, finance or AI", () => {
    expect(hasPermission("VIEWER", "crm.view")).toBe(false);
    expect(hasPermission("VIEWER", "finance.view")).toBe(false);
    expect(hasPermission("VIEWER", "ai.view")).toBe(false);
  });

  it("COMMERCIAL can view CRM but not manage finance", () => {
    expect(hasPermission("COMMERCIAL", "crm.view")).toBe(true);
    expect(hasPermission("COMMERCIAL", "finance.manage")).toBe(false);
  });

  it("FINANCE can view and manage finance but not manage users", () => {
    expect(hasPermission("FINANCE", "finance.view")).toBe(true);
    expect(hasPermission("FINANCE", "finance.manage")).toBe(true);
    expect(hasPermission("FINANCE", "settings.manage")).toBe(false);
  });

  it("OPS can manage orders and logistics", () => {
    expect(hasPermission("OPS", "order.create")).toBe(true);
    expect(hasPermission("OPS", "logistics.manage")).toBe(true);
  });

  it("CEO / DIRECTION has full access", () => {
    expect(hasPermission("CEO", "order.approve")).toBe(true);
    expect(hasPermission("DIRECTION", "finance.manage")).toBe(true);
    expect(hasPermission("CEO", "settings.manage")).toBe(true);
  });

  it("getRolePermissions returns non-empty array for all defined roles", () => {
    const roles = ["ADMIN", "CEO", "OPS", "FINANCE", "COMMERCIAL", "VIEWER"];
    for (const role of roles) {
      const perms = getRolePermissions(role as any);
      expect(Array.isArray(perms), `getRolePermissions(${role}) should return array`).toBe(true);
      expect(perms.length, `${role} should have at least one permission`).toBeGreaterThan(0);
    }
  });
});
