import { prisma } from "@/lib/db";

const DEFAULT_SLA_HOURS: Record<string, number> = {
  NEW: 24,
  CONTACTED: 48,
  QUALIFIED: 36,
  QUOTED: 72,
};

type LeadSlaContext = {
  status: string;
  source?: string | null;
  score?: number | null;
  winProbability?: number | null;
  estimatedValue?: unknown;
  assignedTo?: string | null;
  ownerId?: string | null;
};

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export class LeadSlaService {
  static getHours(status: string, config?: Record<string, number>): number {
    return config?.[status] ?? DEFAULT_SLA_HOURS[status] ?? 0;
  }

  static buildContextualConfig(context: LeadSlaContext): Record<string, number> {
    const base = { ...DEFAULT_SLA_HOURS };
    const status = context.status;
    const currentBase = base[status] ?? 0;
    if (!currentBase) return base;

    let multiplier = 1;
    const source = (context.source || "").toLowerCase();
    const score = Math.max(toNumber(context.score), toNumber(context.winProbability));
    const estimatedValue = toNumber(context.estimatedValue);

    if (source.includes("whatsapp")) multiplier *= 0.75;
    if (score >= 80) multiplier *= 0.65;
    else if (score >= 65) multiplier *= 0.8;

    if (status === "QUOTED" && estimatedValue >= 1_000_000) {
      multiplier *= 0.7;
    } else if (status === "QUALIFIED" && estimatedValue >= 500_000) {
      multiplier *= 0.8;
    }

    if (!context.assignedTo && !context.ownerId) {
      multiplier *= 0.7;
    }

    const adjusted = Math.max(4, Math.round(currentBase * multiplier));
    return { ...base, [status]: adjusted };
  }

  static computeDeadline(status: string, config?: Record<string, number>): Date | null {
    const hours = this.getHours(status, config);
    if (!hours) return null;
    return new Date(Date.now() + hours * 3_600_000);
  }

  static computeStatus(deadline: Date | null): "OK" | "WARNING" | "BREACH" | null {
    if (!deadline) return null;
    const hoursLeft = (deadline.getTime() - Date.now()) / 3_600_000;
    if (hoursLeft < 0) return "BREACH";
    if (hoursLeft < 6) return "WARNING";
    return "OK";
  }

  static computeProfile(context: LeadSlaContext) {
    const config = this.buildContextualConfig(context);
    const slaHours = this.getHours(context.status, config);
    const dueInHours = Math.max(2, Math.round(slaHours * 0.5));
    const deadline = this.computeDeadline(context.status, config);
    return {
      slaHours,
      dueInHours,
      deadline,
      slaStatus: this.computeStatus(deadline),
    };
  }

  static async updateSla(leadId: string, status?: string): Promise<void> {
    try {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: {
          status: true,
          source: true,
          score: true,
          winProbability: true,
          estimatedValue: true,
          assignedTo: true,
          ownerId: true,
        },
      });

      if (!lead) return;

      const profile = this.computeProfile({
        status: status ?? lead.status,
        source: lead.source,
        score: lead.score,
        winProbability: lead.winProbability,
        estimatedValue: lead.estimatedValue,
        assignedTo: lead.assignedTo,
        ownerId: lead.ownerId,
      });

      await prisma.lead.update({
        where: { id: leadId },
        data: { slaDeadline: profile.deadline, slaStatus: profile.slaStatus },
      });
    } catch (error) {
      console.error("[LeadSlaService.updateSla]", error);
    }
  }
}
