import { prisma } from "@/lib/db";

const DEFAULT_ROLES = ["LOGISTICS_MANAGER", "SOURCING_ASSISTANT", "OPS"] as const;

function buildCountMap(rows: Array<{ assignedToId: string | null }>) {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (!row.assignedToId) continue;
    map.set(row.assignedToId, (map.get(row.assignedToId) ?? 0) + 1);
  }
  return map;
}

export class SourcingAssignmentService {
  static async pickAssignee(tenantId: string) {
    let candidates = await prisma.user.findMany({
      where: {
        tenantId,
        isActive: true,
        role: { in: [...DEFAULT_ROLES] as any },
      },
      select: { id: true, name: true, email: true, role: true },
    });

    if (candidates.length === 0) {
      candidates = await prisma.user.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, name: true, email: true, role: true },
      });
    }

    if (candidates.length === 0) return null;

    const [openDemands, openCases] = await Promise.all([
      prisma.demandIntake.findMany({
        where: {
          tenantId,
          status: { in: ["RAW", "QUALIFIED"] },
          assignedToId: { not: null },
        },
        select: { assignedToId: true },
      }),
      prisma.sourcingCase.findMany({
        where: {
          order: { tenantId },
          status: { notIn: ["CONFIRMED", "CANCELLED"] },
          assignedToId: { not: null },
        },
        select: { assignedToId: true },
      }),
    ]);

    const demandMap = buildCountMap(openDemands);
    const caseMap = buildCountMap(openCases);

    let best = candidates[0];
    let bestLoad = Number.POSITIVE_INFINITY;

    for (const candidate of candidates) {
      const demandLoad = demandMap.get(candidate.id) ?? 0;
      const caseLoad = caseMap.get(candidate.id) ?? 0;
      const load = demandLoad + caseLoad * 2;

      if (load < bestLoad) {
        best = candidate;
        bestLoad = load;
        continue;
      }

      if (load === bestLoad) {
        const nameA = candidate.name || candidate.email || candidate.id;
        const nameB = best.name || best.email || best.id;
        if (nameA.localeCompare(nameB) < 0) {
          best = candidate;
          bestLoad = load;
        }
      }
    }

    return best;
  }
}
