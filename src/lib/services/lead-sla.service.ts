import { prisma } from "@/lib/db";

const DEFAULT_SLA_HOURS: Record<string, number> = {
  NEW: 24,
  CONTACTED: 72,
  QUALIFIED: 48,
  QUOTED: 96,
};

export class LeadSlaService {
  static getHours(status: string, config?: Record<string, number>): number {
    return config?.[status] ?? DEFAULT_SLA_HOURS[status] ?? 0;
  }

  static computeDeadline(status: string, config?: Record<string, number>): Date | null {
    const h = this.getHours(status, config);
    if (!h) return null;
    return new Date(Date.now() + h * 3600000);
  }

  static computeStatus(deadline: Date | null): "OK" | "WARNING" | "BREACH" | null {
    if (!deadline) return null;
    const hoursLeft = (deadline.getTime() - Date.now()) / 3600000;
    if (hoursLeft < 0) return "BREACH";
    if (hoursLeft < 4) return "WARNING";
    return "OK";
  }

  static async updateSla(leadId: string, status: string): Promise<void> {
    try {
      const deadline = this.computeDeadline(status);
      const slaStatus = deadline ? this.computeStatus(deadline) : null;
      await prisma.lead.update({
        where: { id: leadId },
        data: { slaDeadline: deadline, slaStatus },
      });
    } catch {
      // Fire-and-forget — ignore errors silently
    }
  }
}
