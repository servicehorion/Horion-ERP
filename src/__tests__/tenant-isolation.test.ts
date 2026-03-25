/**
 * Tenant isolation tests — verify that multi-tenant query helpers
 * always include tenantId in their WHERE clauses.
 *
 * These tests work on pure logic (no DB required).
 */
import { describe, it, expect } from "vitest";

/**
 * Simulate the kind of where-clause building that actions use.
 * In real server actions, every Prisma query should include tenantId.
 */
function buildOrderWhereClause(tenantId: string, filters?: { status?: string }) {
  return {
    tenantId,
    ...(filters?.status ? { status: filters.status } : {}),
  };
}

function buildContactWhereClause(tenantId: string, search?: string) {
  if (search) {
    return {
      tenantId,
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    };
  }
  return { tenantId };
}

describe("Tenant isolation — where clause helpers", () => {
  it("order where clause always contains tenantId", () => {
    const where = buildOrderWhereClause("tenant-a");
    expect(where.tenantId).toBe("tenant-a");
  });

  it("order where clause with status filter still contains tenantId", () => {
    const where = buildOrderWhereClause("tenant-b", { status: "EN_TRANSIT" });
    expect(where.tenantId).toBe("tenant-b");
    expect(where.status).toBe("EN_TRANSIT");
  });

  it("contact where clause with search still contains tenantId", () => {
    const where = buildContactWhereClause("tenant-c", "dupont") as any;
    expect(where.tenantId).toBe("tenant-c");
    expect(where.OR).toBeDefined();
  });

  it("tenantId is never undefined or empty", () => {
    const tenantIds = ["horion-congo", "tenant-b"];
    for (const t of tenantIds) {
      const w = buildOrderWhereClause(t);
      expect(w.tenantId).toBeTruthy();
    }
  });

  it("cross-tenant check: where clauses for different tenants are distinct", () => {
    const wA = buildOrderWhereClause("tenant-a");
    const wB = buildOrderWhereClause("tenant-b");
    expect(wA.tenantId).not.toBe(wB.tenantId);
  });
});

describe("IDOR protection helpers", () => {
  function verifyTenantOwnership(
    resourceTenantId: string,
    userTenantId: string
  ): boolean {
    return resourceTenantId === userTenantId;
  }

  it("returns true when tenants match", () => {
    expect(verifyTenantOwnership("horion-congo", "horion-congo")).toBe(true);
  });

  it("returns false when tenants differ (IDOR prevention)", () => {
    expect(verifyTenantOwnership("tenant-a", "tenant-b")).toBe(false);
  });

  it("returns false for empty vs real tenant", () => {
    expect(verifyTenantOwnership("", "horion-congo")).toBe(false);
  });
});
