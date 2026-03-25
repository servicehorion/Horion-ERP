import { prisma } from "@/lib/db";

type LeadLike = {
  id?: string;
  status: string;
  estimatedValue?: unknown;
  createdAt: Date;
  updatedAt?: Date;
  description?: string | null;
  category?: string | null;
  source?: string | null;
  assignedTo?: string | null;
};

type LeadScoringWeights = {
  value?: number;
  status?: number;
  freshness?: number;
  completeness?: number;
  assignedTo?: number;
};

type LeadScoreModelShape = {
  intercept?: number;
  weights?: Record<string, number>;
  statusBoosts?: Record<string, number>;
  sourceBoosts?: Record<string, number>;
};

const DEFAULT_WEIGHTS: Required<LeadScoringWeights> = {
  value: 0.25,
  status: 0.25,
  freshness: 0.2,
  completeness: 0.2,
  assignedTo: 0.1,
};

const STATUS_SCORE: Record<string, number> = {
  NEW: 0.2,
  CONTACTED: 0.35,
  QUALIFIED: 0.6,
  QUOTED: 0.8,
  WON: 1,
  LOST: 0,
};

const STATUS_BOOSTS: Record<string, number> = {
  NEW: 0,
  CONTACTED: 0.2,
  QUALIFIED: 0.5,
  QUOTED: 0.8,
  WON: 1.2,
  LOST: -1.2,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toNumber = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeSource = (value?: string | null) => (value || "").trim().toLowerCase();

const logit = (p: number) => Math.log(p / (1 - p));

const safeLogit = (p: number) => {
  const clamped = clamp(p, 0.05, 0.95);
  return logit(clamped);
};

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export class LeadScoringService {
  static compute(lead: LeadLike, weights: LeadScoringWeights = DEFAULT_WEIGHTS) {
    const value = toNumber(lead.estimatedValue, 0);
    const valueScore = clamp(Math.log1p(value) / Math.log1p(1_000_000), 0, 1);
    const statusScore = STATUS_SCORE[lead.status] ?? 0.2;
    const completenessFields = [lead.description, lead.category, lead.source, lead.estimatedValue];
    const completeness = completenessFields.filter((f) => f !== undefined && f !== null && String(f).trim()).length / completenessFields.length;
    const assignedScore = lead.assignedTo ? 1 : 0;
    const days = (Date.now() - new Date(lead.createdAt).getTime()) / 86400000;
    const freshness = clamp(1 - days / 30, 0, 1);

    const totalWeight = (weights.value ?? 0) + (weights.status ?? 0) + (weights.freshness ?? 0) + (weights.completeness ?? 0) + (weights.assignedTo ?? 0);
    if (totalWeight <= 0) return 0;

    const score =
      ((weights.value ?? 0) * valueScore +
        (weights.status ?? 0) * statusScore +
        (weights.freshness ?? 0) * freshness +
        (weights.completeness ?? 0) * completeness +
        (weights.assignedTo ?? 0) * assignedScore) /
      totalWeight;

    return Math.round(clamp(score, 0, 1) * 100);
  }

  static computeWinProbability(lead: LeadLike, score: number) {
    let prob = clamp(score, 0, 100);
    if (lead.status === "LOST") prob = 0;
    if (lead.status === "WON") prob = Math.max(prob, 90);
    if (lead.status === "QUOTED") prob = Math.max(prob, 60);
    if (lead.status === "QUALIFIED") prob = Math.max(prob, 45);
    return Math.round(prob);
  }

  static async getWeights(tenantId?: string | null) {
    if (!tenantId) return DEFAULT_WEIGHTS;
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const settings = (tenant?.settings as Record<string, unknown>) || {};
    const weights = settings.leadScoringWeights as LeadScoringWeights | undefined;
    return { ...DEFAULT_WEIGHTS, ...(weights || {}) };
  }

  static computePredictive(lead: LeadLike, model: LeadScoreModelShape) {
    const value = toNumber(lead.estimatedValue, 0);
    const ageDays = (Date.now() - new Date(lead.createdAt).getTime()) / 86400000;
    const completenessFields = [lead.description, lead.category, lead.source, lead.estimatedValue];
    const completeness = completenessFields.filter((f) => f !== undefined && f !== null && String(f).trim()).length / completenessFields.length;
    const assignedScore = lead.assignedTo ? 1 : 0;

    const weights = model.weights || {};
    let z = model.intercept ?? 0;
    z += (weights.value ?? 0.25) * Math.log1p(value);
    z += (weights.age ?? -0.03) * ageDays;
    z += (weights.completeness ?? 0.4) * completeness;
    z += (weights.assigned ?? 0.2) * assignedScore;
    z += (model.statusBoosts?.[lead.status] ?? STATUS_BOOSTS[lead.status] ?? 0);
    z += (model.sourceBoosts?.[normalizeSource(lead.source)] ?? 0);

    const prob = sigmoid(z);
    const score = Math.round(clamp(prob, 0, 1) * 100);

    return {
      score,
      probability: score,
      features: {
        value,
        ageDays,
        completeness,
        assigned: assignedScore,
        status: lead.status,
        source: lead.source ?? null,
      },
    };
  }

  static async getActiveModel(tenantId: string) {
    return prisma.leadScoreModel.findFirst({
      where: { tenantId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });
  }

  static async trainModel(tenantId: string) {
    const history = await prisma.lead.findMany({
      where: {
        contact: { tenantId },
        status: { in: ["WON", "LOST"] },
      },
      select: {
        status: true,
        source: true,
        estimatedValue: true,
        createdAt: true,
        updatedAt: true,
        description: true,
        category: true,
        assignedTo: true,
      },
      take: 2000,
    });

    if (history.length < 20) {
    return prisma.leadScoreModel.create({
      data: {
        tenantId,
        status: "ACTIVE",
        weights: {
          intercept: safeLogit(0.5),
          weights: { value: 0.25, age: -0.03, completeness: 0.4, assigned: 0.2 },
          statusBoosts: STATUS_BOOSTS,
          sourceBoosts: {},
        },
        metrics: { note: "insufficient_history", sample: history.length },
        trainedAt: new Date(),
      },
    });
  }

    const wins = history.filter((l) => l.status === "WON");
    const losses = history.filter((l) => l.status === "LOST");
    const baseRate = wins.length / history.length;
    const baseLogit = safeLogit(baseRate);

    const sourceStats = new Map<string, { total: number; wins: number }>();
    for (const lead of history) {
      const key = normalizeSource(lead.source) || "unknown";
      const stat = sourceStats.get(key) || { total: 0, wins: 0 };
      stat.total += 1;
      if (lead.status === "WON") stat.wins += 1;
      sourceStats.set(key, stat);
    }

    const sourceBoosts: Record<string, number> = {};
    for (const [key, stat] of sourceStats.entries()) {
      if (stat.total < 5) continue;
      const rate = stat.wins / stat.total;
      sourceBoosts[key] = clamp(safeLogit(rate) - baseLogit, -1.5, 1.5);
    }

    const avg = (values: number[]) =>
      values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

    const wonValues = wins.map((l) => Math.log1p(toNumber(l.estimatedValue, 0)));
    const lostValues = losses.map((l) => Math.log1p(toNumber(l.estimatedValue, 0)));
    const valueWeight = clamp(avg(wonValues) - avg(lostValues), -0.4, 0.4);

    const wonAge = wins.map((l) => (new Date(l.updatedAt ?? l.createdAt).getTime() - new Date(l.createdAt).getTime()) / 86400000);
    const lostAge = losses.map((l) => (new Date(l.updatedAt ?? l.createdAt).getTime() - new Date(l.createdAt).getTime()) / 86400000);
    const ageWeight = clamp((avg(wonAge) - avg(lostAge)) / 60, -0.2, 0.2);

    const completenessScore = (lead: LeadLike) => {
      const fields = [lead.description, lead.category, lead.source, lead.estimatedValue];
      return fields.filter((f) => f !== undefined && f !== null && String(f).trim()).length / fields.length;
    };

    const wonCompleteness = wins.map((l) => completenessScore(l as LeadLike));
    const lostCompleteness = losses.map((l) => completenessScore(l as LeadLike));
    const completenessWeight = clamp(avg(wonCompleteness) - avg(lostCompleteness), -0.5, 0.5);

    const assignedWeight = clamp(
      avg(wins.map((l) => (l.assignedTo ? 1 : 0))) - avg(losses.map((l) => (l.assignedTo ? 1 : 0))),
      -0.3,
      0.3
    );

    const nextVersion = await prisma.leadScoreModel.count({ where: { tenantId } });

    await prisma.leadScoreModel.updateMany({
      where: { tenantId, status: "ACTIVE" },
      data: { status: "INACTIVE" },
    });

    return prisma.leadScoreModel.create({
      data: {
        tenantId,
        status: "ACTIVE",
        version: nextVersion + 1,
        weights: {
          intercept: baseLogit,
          weights: {
            value: 0.25 + valueWeight,
            age: -0.03 + ageWeight,
            completeness: 0.4 + completenessWeight,
            assigned: 0.2 + assignedWeight,
          },
          statusBoosts: STATUS_BOOSTS,
          sourceBoosts,
        },
        metrics: {
          sample: history.length,
          baseRate: Math.round(baseRate * 100),
        },
        trainedAt: new Date(),
      } as any,
    });
  }

  static async scoreLead(lead: LeadLike & { id: string }, tenantId: string) {
    const model = await this.getActiveModel(tenantId);
    const modelShape = (model?.weights as LeadScoreModelShape) || null;
    const result = modelShape
      ? this.computePredictive(lead, modelShape)
      : { score: this.compute(lead), probability: this.computeWinProbability(lead, this.compute(lead)), features: {} };

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        score: result.score,
        winProbability: result.probability,
        scoredAt: new Date(),
      },
    });

    await prisma.leadScoreSnapshot.create({
      data: {
        tenantId,
        leadId: lead.id,
        modelId: model?.id,
        score: result.score,
        probability: result.probability,
        features: result.features ?? {},
      },
    });

    return result;
  }

  static async recalculate(leadId: string): Promise<void> {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { contact: { select: { tenantId: true } } },
    });
    if (!lead || !lead.contact?.tenantId) return;

    await this.scoreLead(
      {
        id: lead.id,
        status: lead.status,
        estimatedValue: lead.estimatedValue,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
        description: lead.description,
        category: lead.category,
        source: lead.source,
        assignedTo: lead.assignedTo,
      },
      lead.contact.tenantId
    );
  }
}
