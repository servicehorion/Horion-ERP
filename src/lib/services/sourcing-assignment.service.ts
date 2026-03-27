import { prisma } from "@/lib/db";
import { SourcingSlaService } from "@/lib/services/sourcing-sla.service";

const DEFAULT_ROLES = ["LOGISTICS_MANAGER", "SOURCING_ASSISTANT", "OPS"] as const;

type AssignmentInput = {
  entityType?: "demand" | "sourcing_case";
  category?: string | null;
  pipelineType?: string | null;
  urgency?: string | null;
  preferredIds?: string[];
};

type Candidate = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  assignmentReason?: string;
};

function countByAssignee<T extends { assignedToId: string | null }>(rows: T[]) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    if (!row.assignedToId) continue;
    const list = map.get(row.assignedToId) ?? [];
    list.push(row);
    map.set(row.assignedToId, list);
  }
  return map;
}

function safeName(candidate: Candidate) {
  return candidate.name || candidate.email || candidate.id;
}

function roleBonus(role: string, urgency?: string | null) {
  if (urgency === "CRITICAL") {
    if (role === "LOGISTICS_MANAGER" || role === "OPS") return 6;
    if (role === "SOURCING_ASSISTANT") return 2;
  }

  if (role === "SOURCING_ASSISTANT") return 4;
  if (role === "LOGISTICS_MANAGER") return 2;
  return 0;
}

export class SourcingAssignmentService {
  static async pickAssignee(tenantId: string, input: AssignmentInput = {}): Promise<Candidate | null> {
    let candidates: Candidate[] = await prisma.user.findMany({
      where: {
        tenantId,
        isActive: true,
        role: { in: [...DEFAULT_ROLES] as any },
      },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    });

    if (candidates.length === 0) {
      candidates = await prisma.user.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      });
    }

    if (candidates.length === 0) return null;

    const candidateIds = candidates.map((candidate) => candidate.id);
    const [openDemands, openCases, historicalCases] = await Promise.all([
      prisma.demandIntake.findMany({
        where: {
          tenantId,
          status: { in: ["RAW", "QUALIFIED", "INDICATIF_PENDING"] },
          assignedToId: { in: candidateIds },
        },
        select: {
          assignedToId: true,
          category: true,
          urgency: true,
        },
      }),
      prisma.sourcingCase.findMany({
        where: {
          order: { tenantId },
          status: { notIn: ["CONFIRMED", "CANCELLED"] },
          assignedToId: { in: candidateIds },
        },
        select: {
          assignedToId: true,
          status: true,
          category: true,
          pipelineType: true,
          stageEnteredAt: true,
          level: true,
          platform: true,
          sensitiveProduct: true,
        },
      }),
      prisma.sourcingCase.findMany({
        where: {
          order: { tenantId },
          assignedToId: { in: candidateIds },
          ...(input.category ? { category: input.category } : {}),
        },
        select: {
          assignedToId: true,
          category: true,
          pipelineType: true,
        },
        take: 500,
      }),
    ]);

    const demandMap = countByAssignee(openDemands);
    const caseMap = countByAssignee(openCases);
    const historicalMap = countByAssignee(historicalCases);
    const preferredIds = new Set((input.preferredIds ?? []).filter(Boolean));

    let best: Candidate | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    let bestReason = "";

    for (const candidate of candidates) {
      const candidateDemands = demandMap.get(candidate.id) ?? [];
      const candidateCases = caseMap.get(candidate.id) ?? [];
      const candidateHistory = historicalMap.get(candidate.id) ?? [];

      const overdueCases = candidateCases.filter((item) => {
        const sla = SourcingSlaService.compute(item.status ?? "SEARCHING", item.stageEnteredAt ?? new Date(), {
          level: item.level,
          pipelineType: item.pipelineType,
          category: item.category,
          platform: item.platform,
          sensitiveProduct: item.sensitiveProduct,
        });
        return sla.status === "BREACHED";
      }).length;

      const openLoad = candidateDemands.length + candidateCases.length * 2;
      const historyScore = Math.min(6, candidateHistory.length * 0.75);
      const continuityBonus = preferredIds.has(candidate.id) ? 8 : 0;
      const candidateRoleBonus = roleBonus(candidate.role, input.urgency);
      const score = 100 - openLoad * 12 - overdueCases * 16 + historyScore + continuityBonus + candidateRoleBonus;

      const reasonParts = [
        continuityBonus > 0 ? "continuite dossier" : null,
        historyScore > 0 ? `experience ${input.category || "sourcing"}` : null,
        candidateRoleBonus > 0 ? `role ${candidate.role}` : null,
        overdueCases > 0 ? `${overdueCases} SLA en retard` : null,
        `${candidateDemands.length} demandes / ${candidateCases.length} cas actifs`,
      ].filter(Boolean);

      if (score > bestScore) {
        best = candidate;
        bestScore = score;
        bestReason = reasonParts.join(" - ");
        continue;
      }

      if (score === bestScore && best && safeName(candidate).localeCompare(safeName(best)) < 0) {
        best = candidate;
        bestReason = reasonParts.join(" - ");
      }
    }

    return best ? { ...best, assignmentReason: bestReason } : null;
  }
}
