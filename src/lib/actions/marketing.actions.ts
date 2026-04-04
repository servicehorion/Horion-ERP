"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const DEFAULT_TENANT_ID = "horion-congo";
const MARKETING_PATH = "/marketing";
const NATIVE_CONTENT_CHANNELS = new Set(["FACEBOOK", "INSTAGRAM"]);

type JsonObject = Record<string, unknown>;
type SessionContext = {
  userId: string | null;
  userName: string | null;
  tenantId: string;
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asObject(value: unknown): JsonObject {
  return isObject(value) ? value : {};
}

function toOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNumberRecord(value: unknown): Record<string, number> {
  if (!isObject(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value)) {
    const numeric = toNumber(raw);
    if (numeric !== null) out[key] = numeric;
  }
  return out;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizePlatforms(input: string[] | undefined, fallbackFormat: string): string[] {
  const source = input && input.length > 0 ? input : [fallbackFormat];
  const set = new Set(
    source
      .map((platform) => platform.trim().toUpperCase())
      .filter((platform) => platform.length > 0)
  );
  return Array.from(set);
}

function resolveAccessToken(postingRules: Prisma.JsonValue): string | null {
  const rules = asObject(postingRules);
  const direct = toOptionalString(rules.accessToken) ?? toOptionalString(rules.token);
  if (direct) return direct;
  const authNode = asObject(rules.auth);
  return toOptionalString(authNode.accessToken) ?? toOptionalString(authNode.token);
}

async function getSessionContext(): Promise<SessionContext> {
  const session = await auth().catch(() => null);
  const user = asObject(session?.user);

  return {
    userId: toOptionalString(user.id),
    userName: toOptionalString(user.name),
    tenantId: toOptionalString(user.tenantId) ?? DEFAULT_TENANT_ID,
  };
}

async function requireSessionContext(): Promise<
  { ok: true; ctx: SessionContext } | { ok: false; error: string }
> {
  const ctx = await getSessionContext();
  if (!ctx.userId) {
    return { ok: false, error: "Non authentifie" };
  }
  return { ok: true, ctx };
}

async function getTenantSettings(tenantId: string): Promise<JsonObject> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  return asObject(tenant?.settings);
}

async function updateTenantSettings(
  tenantId: string,
  updater: (current: JsonObject) => JsonObject
): Promise<void> {
  const current = await getTenantSettings(tenantId);
  const next = updater(current);
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: next as Prisma.InputJsonValue },
  });
}

type CampaignMeta = { description: string | null; budget: number | null };
type CampaignMetaMap = Record<string, CampaignMeta>;

function readCampaignMetaMap(settings: JsonObject): CampaignMetaMap {
  const rawMap = asObject(settings.marketingCampaignMeta);
  const map: CampaignMetaMap = {};

  for (const [campaignId, raw] of Object.entries(rawMap)) {
    const node = asObject(raw);
    map[campaignId] = {
      description: toOptionalString(node.description),
      budget: toNumber(node.budget),
    };
  }

  return map;
}

function applyCampaignMetaMap(settings: JsonObject, map: CampaignMetaMap): JsonObject {
  return {
    ...settings,
    marketingCampaignMeta: map,
  };
}

function pickScheduledAt(
  publishingQueues: Array<{ scheduledAt: Date; publishedAt: Date | null }>
): Date | null {
  const pending = publishingQueues
    .filter((queue) => queue.publishedAt === null)
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  return pending[0]?.scheduledAt ?? null;
}

async function syncPublishingQueue(params: {
  postId: string;
  tenantId: string;
  platforms: string[];
  scheduledAt: Date | null;
}): Promise<void> {
  await prisma.publishingQueue.deleteMany({
    where: { postId: params.postId, publishedAt: null },
  });

  if (!params.scheduledAt || params.platforms.length === 0) return;

  const channels = await prisma.channel.findMany({
    where: {
      tenantId: params.tenantId,
      platform: { in: params.platforms },
      status: "active",
    },
    select: { id: true },
  });

  if (channels.length === 0) return;

  await prisma.publishingQueue.createMany({
    data: channels.map((channel) => ({
      postId: params.postId,
      channelId: channel.id,
      scheduledAt: params.scheduledAt!,
    })),
  });
}

export type ContentPostItem = {
  id: string;
  tenantId: string;
  authorId: string | null;
  format: string;
  theme: string | null;
  category: string | null;
  title: string | null;
  body: string | null;
  language: string;
  status: string;
  createdBy: string;
  channelTargets: string[];
  publishedAt: Date | null;
  scheduledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CampaignItem = {
  id: string;
  tenantId: string;
  name: string;
  objective: string;
  description: string | null;
  channels: string[];
  kpiTargets: Record<string, number>;
  budget: number | null;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ChannelItem = {
  id: string;
  tenantId: string;
  platform: string;
  type: string;
  name: string;
  link: string | null;
  category: string | null;
  status: string;
  rules: Record<string, unknown>;
  ownerId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SocialAccountItem = {
  id: string;
  platform: string;
  name: string | null;
  handle: string | null;
  followerCount: number;
  authStatus: string;
};

export type MarketingStats = {
  totalPosts: number;
  publishedPosts: number;
  scheduledPosts: number;
  draftPosts: number;
  activeCampaigns: number;
  totalCampaigns: number;
  activeChannels: number;
  leadsGenerated: number;
};

function mapContentPost(
  post: Prisma.ContentPostGetPayload<{ include: { publishingQueues: true } }>,
  tenantId: string
): ContentPostItem {
  return {
    id: post.id,
    tenantId,
    authorId: null,
    format: post.format,
    theme: post.theme ?? null,
    category: post.category ?? null,
    title: post.title ?? null,
    body: post.body ?? null,
    language: post.language,
    status: post.status,
    createdBy: post.createdBy,
    channelTargets: toStringArray(post.channelTargets),
    publishedAt: post.publishedAt ?? null,
    scheduledAt: pickScheduledAt(post.publishingQueues),
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

function mapCampaign(
  campaign: Prisma.CampaignGetPayload<Record<string, never>>,
  tenantId: string,
  meta: CampaignMeta | undefined
): CampaignItem {
  return {
    id: campaign.id,
    tenantId,
    name: campaign.name,
    objective: campaign.objective,
    description: meta?.description ?? null,
    channels: toStringArray(campaign.channels),
    kpiTargets: toNumberRecord(campaign.kpiTargets),
    budget: meta?.budget ?? null,
    status: campaign.status,
    startDate: campaign.startDate ?? null,
    endDate: campaign.endDate ?? null,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
  };
}

export async function getMarketingStats(): Promise<MarketingStats> {
  try {
    const ctx = await getSessionContext();
    const [totalPosts, publishedPosts, scheduledPosts, draftPosts, activeCampaigns, totalCampaigns, activeChannels] =
      await Promise.all([
        prisma.contentPost.count(),
        prisma.contentPost.count({ where: { status: "published" } }),
        prisma.contentPost.count({ where: { status: "scheduled" } }),
        prisma.contentPost.count({ where: { status: "draft" } }),
        prisma.campaign.count({ where: { status: "active" } }),
        prisma.campaign.count(),
        prisma.channel.count({ where: { tenantId: ctx.tenantId, status: "active" } }),
      ]);

    return {
      totalPosts,
      publishedPosts,
      scheduledPosts,
      draftPosts,
      activeCampaigns,
      totalCampaigns,
      activeChannels,
      leadsGenerated: 0,
    };
  } catch {
    return {
      totalPosts: 0,
      publishedPosts: 0,
      scheduledPosts: 0,
      draftPosts: 0,
      activeCampaigns: 0,
      totalCampaigns: 0,
      activeChannels: 0,
      leadsGenerated: 0,
    };
  }
}

export async function getContentPosts(filters?: {
  status?: string;
  format?: string;
  category?: string;
}): Promise<{ data: ContentPostItem[]; error?: string }> {
  try {
    const ctx = await getSessionContext();
    const where: Prisma.ContentPostWhereInput = {};

    if (filters?.status && filters.status !== "all") where.status = filters.status;
    if (filters?.format && filters.format !== "all") where.format = filters.format;
    if (filters?.category && filters.category !== "all") where.category = filters.category;

    const posts = await prisma.contentPost.findMany({
      where,
      include: {
        publishingQueues: {
          where: { publishedAt: null },
          orderBy: { scheduledAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return { data: posts.map((post) => mapContentPost(post, ctx.tenantId)) };
  } catch (error) {
    return { data: [], error: String(error) };
  }
}

export async function createContentPost(data: {
  format: string;
  theme?: string;
  category?: string;
  title?: string;
  body?: string;
  status?: string;
  channelTargets?: string[];
  scheduledAt?: string;
}): Promise<{ data?: ContentPostItem; error?: string }> {
  const authResult = await requireSessionContext();
  if (!authResult.ok) return { error: "Non authentifie" };
  const { ctx } = authResult;

  try {
    const scheduledAt = toDate(data.scheduledAt);
    const status = data.status ?? (scheduledAt ? "scheduled" : "draft");
    const platforms = normalizePlatforms(data.channelTargets, data.format);

    const created = await prisma.contentPost.create({
      data: {
        format: data.format.trim(),
        theme: toOptionalString(data.theme),
        category: toOptionalString(data.category),
        title: toOptionalString(data.title),
        body: toOptionalString(data.body),
        status,
        createdBy: ctx.userName ?? "human",
        channelTargets: platforms as Prisma.InputJsonValue,
        publishedAt: status === "published" ? new Date() : null,
      },
      include: { publishingQueues: true },
    });

    await syncPublishingQueue({
      postId: created.id,
      tenantId: ctx.tenantId,
      platforms,
      scheduledAt,
    });

    const reloaded = await prisma.contentPost.findUnique({
      where: { id: created.id },
      include: {
        publishingQueues: {
          where: { publishedAt: null },
          orderBy: { scheduledAt: "asc" },
        },
      },
    });

    revalidatePath(MARKETING_PATH);
    return { data: mapContentPost(reloaded ?? created, ctx.tenantId) };
  } catch (error) {
    return { error: String(error) };
  }
}

export async function updateContentPost(
  id: string,
  data: {
    title?: string;
    body?: string;
    status?: string;
    theme?: string;
    category?: string;
    channelTargets?: string[];
    scheduledAt?: string | null;
  }
): Promise<{ success?: boolean; error?: string }> {
  const authResult = await requireSessionContext();
  if (!authResult.ok) return { error: "Non authentifie" };
  const { ctx } = authResult;

  try {
    const existing = await prisma.contentPost.findUnique({
      where: { id },
      select: { id: true, format: true, channelTargets: true },
    });
    if (!existing) return { error: "Post introuvable" };

    const scheduledAt = data.scheduledAt === null ? null : toDate(data.scheduledAt);
    const platforms = normalizePlatforms(
      data.channelTargets ?? toStringArray(existing.channelTargets),
      existing.format
    );

    const status =
      data.status ??
      (scheduledAt ? "scheduled" : undefined);

    await prisma.contentPost.update({
      where: { id },
      data: {
        title: data.title === undefined ? undefined : toOptionalString(data.title),
        body: data.body === undefined ? undefined : toOptionalString(data.body),
        status,
        theme: data.theme === undefined ? undefined : toOptionalString(data.theme),
        category: data.category === undefined ? undefined : toOptionalString(data.category),
        channelTargets: data.channelTargets ? (platforms as Prisma.InputJsonValue) : undefined,
        publishedAt: status === "published" ? new Date() : undefined,
      },
    });

    await syncPublishingQueue({
      postId: id,
      tenantId: ctx.tenantId,
      platforms,
      scheduledAt,
    });

    revalidatePath(MARKETING_PATH);
    return { success: true };
  } catch (error) {
    return { error: String(error) };
  }
}

export async function deleteContentPost(id: string): Promise<{ success?: boolean; error?: string }> {
  const authResult = await requireSessionContext();
  if (!authResult.ok) return { error: "Non authentifie" };

  try {
    await prisma.publishingQueue.deleteMany({ where: { postId: id } });
    await prisma.contentPost.delete({ where: { id } });
    revalidatePath(MARKETING_PATH);
    return { success: true };
  } catch (error) {
    return { error: String(error) };
  }
}

export async function getCampaigns(): Promise<{ data: CampaignItem[]; error?: string }> {
  try {
    const ctx = await getSessionContext();
    const [campaigns, settings] = await Promise.all([
      prisma.campaign.findMany({ orderBy: { createdAt: "desc" } }),
      getTenantSettings(ctx.tenantId),
    ]);

    const metaMap = readCampaignMetaMap(settings);
    return {
      data: campaigns.map((campaign) => mapCampaign(campaign, ctx.tenantId, metaMap[campaign.id])),
    };
  } catch (error) {
    return { data: [], error: String(error) };
  }
}

export async function createCampaign(data: {
  name: string;
  objective: string;
  description?: string;
  channels: string[];
  budget?: number;
  kpiTargets?: Record<string, number>;
  startDate?: string;
  endDate?: string;
}): Promise<{ data?: CampaignItem; error?: string }> {
  const authResult = await requireSessionContext();
  if (!authResult.ok) return { error: "Non authentifie" };
  const { ctx } = authResult;

  try {
    const campaign = await prisma.campaign.create({
      data: {
        name: data.name.trim(),
        objective: data.objective.trim(),
        channels: normalizePlatforms(data.channels, "WHATSAPP") as Prisma.InputJsonValue,
        kpiTargets: (data.kpiTargets ?? {}) as Prisma.InputJsonValue,
        startDate: toDate(data.startDate),
        endDate: toDate(data.endDate),
        status: "draft",
      },
    });

    const description = toOptionalString(data.description);
    const budget = toNumber(data.budget);

    if (description !== null || budget !== null) {
      await updateTenantSettings(ctx.tenantId, (settings) => {
        const metaMap = readCampaignMetaMap(settings);
        metaMap[campaign.id] = { description, budget };
        return applyCampaignMetaMap(settings, metaMap);
      });
    }

    revalidatePath(MARKETING_PATH);
    return {
      data: mapCampaign(campaign, ctx.tenantId, {
        description,
        budget,
      }),
    };
  } catch (error) {
    return { error: String(error) };
  }
}

export async function updateCampaignStatus(
  id: string,
  status: string
): Promise<{ success?: boolean; error?: string }> {
  const authResult = await requireSessionContext();
  if (!authResult.ok) return { error: "Non authentifie" };

  try {
    await prisma.campaign.update({ where: { id }, data: { status } });
    revalidatePath(MARKETING_PATH);
    return { success: true };
  } catch (error) {
    return { error: String(error) };
  }
}

export async function deleteCampaign(id: string): Promise<{ success?: boolean; error?: string }> {
  const authResult = await requireSessionContext();
  if (!authResult.ok) return { error: "Non authentifie" };
  const { ctx } = authResult;

  try {
    await prisma.campaign.delete({ where: { id } });

    await updateTenantSettings(ctx.tenantId, (settings) => {
      const metaMap = readCampaignMetaMap(settings);
      delete metaMap[id];
      return applyCampaignMetaMap(settings, metaMap);
    });

    revalidatePath(MARKETING_PATH);
    return { success: true };
  } catch (error) {
    return { error: String(error) };
  }
}

export async function getMarketingChannels(): Promise<{ data: ChannelItem[]; error?: string }> {
  try {
    const ctx = await getSessionContext();
    const channels = await prisma.channel.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: "desc" },
    });

    return {
      data: channels.map((channel) => ({
        id: channel.id,
        tenantId: channel.tenantId,
        platform: channel.platform,
        type: channel.type,
        name: channel.name,
        link: channel.link ?? null,
        category: channel.category ?? null,
        status: channel.status,
        rules: asObject(channel.rules),
        ownerId: channel.ownerId ?? null,
        createdAt: channel.createdAt,
        updatedAt: channel.updatedAt,
      })),
    };
  } catch (error) {
    return { data: [], error: String(error) };
  }
}

export async function createMarketingChannel(data: {
  platform: string;
  type: string;
  name: string;
  link?: string;
  category?: string;
}): Promise<{ success?: boolean; error?: string }> {
  const authResult = await requireSessionContext();
  if (!authResult.ok) return { error: "Non authentifie" };
  const { ctx } = authResult;

  try {
    await prisma.channel.create({
      data: {
        tenantId: ctx.tenantId,
        platform: data.platform.trim().toUpperCase(),
        type: data.type.trim(),
        name: data.name.trim(),
        link: toOptionalString(data.link),
        category: toOptionalString(data.category),
        status: "active",
        rules: {},
      },
    });
    revalidatePath(MARKETING_PATH);
    return { success: true };
  } catch (error) {
    return { error: String(error) };
  }
}

export async function deleteMarketingChannel(id: string): Promise<{ success?: boolean; error?: string }> {
  const authResult = await requireSessionContext();
  if (!authResult.ok) return { error: "Non authentifie" };
  const { ctx } = authResult;

  try {
    const result = await prisma.channel.deleteMany({
      where: { id, tenantId: ctx.tenantId },
    });
    if (result.count === 0) return { error: "Canal introuvable" };
    revalidatePath(MARKETING_PATH);
    return { success: true };
  } catch (error) {
    return { error: String(error) };
  }
}

export async function getSocialAccounts(): Promise<{ data: SocialAccountItem[]; error?: string }> {
  try {
    const accounts = await prisma.socialAccount.findMany({
      orderBy: { platform: "asc" },
    });

    return {
      data: accounts.map((account) => {
        const postingRules = asObject(account.postingRules);
        const name =
          toOptionalString(postingRules.displayName) ??
          toOptionalString(postingRules.name) ??
          account.handle ??
          null;
        const followerCount = toNumber(postingRules.followerCount) ?? 0;
        return {
          id: account.id,
          platform: account.platform,
          name,
          handle: account.handle ?? null,
          followerCount,
          authStatus: account.authStatus,
        };
      }),
    };
  } catch (error) {
    return { data: [], error: String(error) };
  }
}

export type BrandSettings = {
  name: string;
  tagline: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  font: string;
  tone: string;
  persona: string;
  keyMessages: string[];
  dos: string[];
  donts: string[];
  assets: { label: string; url: string }[];
  competitors: string[];
};

const DEFAULT_BRAND: BrandSettings = {
  name: "Horion",
  tagline: "Import Chine -> Congo sans stress",
  logoUrl: "",
  primaryColor: "#1f3c88",
  secondaryColor: "#0ea5e9",
  accentColor: "#f59e0b",
  font: "Inter",
  tone: "professionnel",
  persona:
    "Partenaire import fiable pour les entreprises Afrique Centrale. Transparence, preuve, execution.",
  keyMessages: [
    "Sourcing direct en Chine",
    "Controle qualite avant expedition",
    "Suivi logistique de bout en bout",
    "Prix et delais previsibles",
  ],
  dos: [
    "Parler avec des chiffres concrets",
    "Montrer les preuves terrain",
    "Rester clair sur delais et contraintes",
    "Adapter le message au canal",
  ],
  donts: [
    "Promettre des delais non garantis",
    "Utiliser un ton agressif",
    "Publier sans validation",
    "Masquer les risques operationnels",
  ],
  assets: [],
  competitors: [],
};

function readBrandSettings(settings: JsonObject): BrandSettings {
  const raw = asObject(settings.marketingBrand);
  const rawAssets = Array.isArray(raw.assets) ? raw.assets : [];
  const assets = rawAssets
    .map((item) => asObject(item))
    .map((item) => ({
      label: toOptionalString(item.label) ?? "",
      url: toOptionalString(item.url) ?? "",
    }))
    .filter((item) => item.label.length > 0 && item.url.length > 0);

  return {
    ...DEFAULT_BRAND,
    ...raw,
    name: toOptionalString(raw.name) ?? DEFAULT_BRAND.name,
    tagline: toOptionalString(raw.tagline) ?? DEFAULT_BRAND.tagline,
    logoUrl: toOptionalString(raw.logoUrl) ?? DEFAULT_BRAND.logoUrl,
    primaryColor: toOptionalString(raw.primaryColor) ?? DEFAULT_BRAND.primaryColor,
    secondaryColor: toOptionalString(raw.secondaryColor) ?? DEFAULT_BRAND.secondaryColor,
    accentColor: toOptionalString(raw.accentColor) ?? DEFAULT_BRAND.accentColor,
    font: toOptionalString(raw.font) ?? DEFAULT_BRAND.font,
    tone: toOptionalString(raw.tone) ?? DEFAULT_BRAND.tone,
    persona: toOptionalString(raw.persona) ?? DEFAULT_BRAND.persona,
    keyMessages: toStringArray(raw.keyMessages),
    dos: toStringArray(raw.dos),
    donts: toStringArray(raw.donts),
    assets,
    competitors: toStringArray(raw.competitors),
  };
}

export async function getBrandSettings(): Promise<BrandSettings> {
  try {
    const ctx = await getSessionContext();
    const settings = await getTenantSettings(ctx.tenantId);
    return readBrandSettings(settings);
  } catch {
    return DEFAULT_BRAND;
  }
}

export async function saveBrandSettings(
  brand: BrandSettings
): Promise<{ success?: boolean; error?: string }> {
  const authResult = await requireSessionContext();
  if (!authResult.ok) return { error: "Non authentifie" };
  const { ctx } = authResult;

  try {
    await updateTenantSettings(ctx.tenantId, (settings) => ({
      ...settings,
      marketingBrand: brand,
    }));
    revalidatePath(MARKETING_PATH);
    return { success: true };
  } catch (error) {
    return { error: String(error) };
  }
}

export type AudienceData = {
  contacts: {
    total: number;
    clients: number;
    prospects: number;
    suppliers: number;
    others: number;
    byType: { type: string; label: string; count: number; pct: number; color: string }[];
    recent: Array<{
      id: string;
      name: string;
      company: string | null;
      type: string;
      city: string | null;
      country: string;
      createdAt: Date;
    }>;
    topClients: Array<{ id: string; name: string; company: string | null; orderCount: number; totalValue: number }>;
  };
  leads: {
    total: number;
    wonCount: number;
    lostCount: number;
    conversionRate: number;
    totalPipelineValue: number;
    byStatus: { status: string; label: string; count: number; color: string }[];
    byContainerType: { type: string; count: number; pct: number }[];
    byOriginCountry: { country: string; count: number }[];
    recent: Array<{
      id: string;
      contactName: string;
      company: string | null;
      status: string;
      estimatedValue: number | null;
      containerType: string | null;
      originCountry: string | null;
      createdAt: Date;
    }>;
  };
  orders: {
    total: number;
    recent90d: number;
    totalValue: number;
    avgValue: number;
    byOriginCountry: { country: string; count: number }[];
    byMonth: { month: string; count: number; value: number }[];
  };
};

const CONTACT_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  CLIENT: { label: "Client", color: "bg-green-500" },
  PROSPECT: { label: "Prospect", color: "bg-blue-500" },
  SUPPLIER: { label: "Fournisseur", color: "bg-purple-500" },
  FREIGHT_PARTNER: { label: "Partenaire fret", color: "bg-orange-500" },
  CUSTOMS_BROKER: { label: "Transitaire", color: "bg-yellow-500" },
  QC_PARTNER: { label: "Partenaire QC", color: "bg-pink-500" },
  OTHER: { label: "Autre", color: "bg-gray-400" },
};

const LEAD_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  NEW: { label: "Nouveau", color: "bg-blue-400" },
  CONTACTED: { label: "Contacte", color: "bg-indigo-500" },
  QUALIFIED: { label: "Qualifie", color: "bg-purple-500" },
  QUOTED: { label: "Devise", color: "bg-yellow-500" },
  WON: { label: "Gagne", color: "bg-green-500" },
  LOST: { label: "Perdu", color: "bg-red-400" },
};

export async function getAudienceData(): Promise<AudienceData> {
  const empty: AudienceData = {
    contacts: {
      total: 0,
      clients: 0,
      prospects: 0,
      suppliers: 0,
      others: 0,
      byType: [],
      recent: [],
      topClients: [],
    },
    leads: {
      total: 0,
      wonCount: 0,
      lostCount: 0,
      conversionRate: 0,
      totalPipelineValue: 0,
      byStatus: [],
      byContainerType: [],
      byOriginCountry: [],
      recent: [],
    },
    orders: {
      total: 0,
      recent90d: 0,
      totalValue: 0,
      avgValue: 0,
      byOriginCountry: [],
      byMonth: [],
    },
  };

  try {
    const ctx = await getSessionContext();

    const [contacts, leads, orders] = await Promise.all([
      prisma.contact.findMany({
        where: { tenantId: ctx.tenantId },
        select: {
          id: true,
          name: true,
          company: true,
          type: true,
          city: true,
          country: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 1000,
      }),
      prisma.lead.findMany({
        where: { contact: { tenantId: ctx.tenantId }, isArchived: false },
        select: {
          id: true,
          status: true,
          containerType: true,
          originCountry: true,
          estimatedValue: true,
          createdAt: true,
          contact: { select: { id: true, name: true, company: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 1000,
      }),
      prisma.order.findMany({
        where: { tenantId: ctx.tenantId },
        select: {
          id: true,
          contactId: true,
          originCountry: true,
          totalClient: true,
          createdAt: true,
          contact: { select: { name: true, company: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 1000,
      }),
    ]);

    const contactTypeMap: Record<string, number> = {};
    for (const contact of contacts) {
      contactTypeMap[contact.type] = (contactTypeMap[contact.type] ?? 0) + 1;
    }

    const totalContacts = contacts.length;
    const contactByType = Object.entries(contactTypeMap)
      .map(([type, count]) => ({
        type,
        label: CONTACT_TYPE_CONFIG[type]?.label ?? type,
        color: CONTACT_TYPE_CONFIG[type]?.color ?? "bg-gray-400",
        count,
        pct: totalContacts > 0 ? Math.round((count / totalContacts) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const ordersByContact: Record<
      string,
      { name: string; company: string | null; orderCount: number; totalValue: number }
    > = {};
    for (const order of orders) {
      const current = ordersByContact[order.contactId] ?? {
        name: order.contact.name,
        company: order.contact.company ?? null,
        orderCount: 0,
        totalValue: 0,
      };
      current.orderCount += 1;
      current.totalValue += Number(order.totalClient);
      ordersByContact[order.contactId] = current;
    }

    const topClients = Object.entries(ordersByContact)
      .sort(([, a], [, b]) => b.totalValue - a.totalValue)
      .slice(0, 8)
      .map(([id, value]) => ({
        id,
        name: value.name,
        company: value.company,
        orderCount: value.orderCount,
        totalValue: Math.round(value.totalValue),
      }));

    const leadStatusMap: Record<string, number> = {};
    const leadContainerMap: Record<string, number> = {};
    const leadOriginMap: Record<string, number> = {};
    let totalPipelineValue = 0;

    for (const lead of leads) {
      leadStatusMap[lead.status] = (leadStatusMap[lead.status] ?? 0) + 1;
      if (lead.containerType) {
        leadContainerMap[lead.containerType] = (leadContainerMap[lead.containerType] ?? 0) + 1;
      }
      if (lead.originCountry) {
        leadOriginMap[lead.originCountry] = (leadOriginMap[lead.originCountry] ?? 0) + 1;
      }
      if (lead.status !== "LOST" && lead.estimatedValue !== null) {
        totalPipelineValue += Number(lead.estimatedValue);
      }
    }

    const wonCount = leadStatusMap.WON ?? 0;
    const lostCount = leadStatusMap.LOST ?? 0;
    const closedCount = wonCount + lostCount;

    const leadByStatus = Object.entries(LEAD_STATUS_CONFIG)
      .map(([status, cfg]) => ({
        status,
        label: cfg.label,
        color: cfg.color,
        count: leadStatusMap[status] ?? 0,
      }))
      .filter((entry) => entry.count > 0);

    const totalContainer = Object.values(leadContainerMap).reduce((sum, value) => sum + value, 0);
    const leadByContainer = Object.entries(leadContainerMap)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({
        type,
        count,
        pct: totalContainer > 0 ? Math.round((count / totalContainer) * 100) : 0,
      }));

    const leadByOrigin = Object.entries(leadOriginMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([country, count]) => ({ country, count }));

    const now = new Date();
    const ago90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const recent90d = orders.filter((order) => order.createdAt >= ago90).length;
    const totalOrderValue = orders.reduce((sum, order) => sum + Number(order.totalClient), 0);

    const orderOriginMap: Record<string, number> = {};
    for (const order of orders) {
      const country = order.originCountry ?? "CN";
      orderOriginMap[country] = (orderOriginMap[country] ?? 0) + 1;
    }
    const orderByOrigin = Object.entries(orderOriginMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([country, count]) => ({ country, count }));

    const orderMonthMap: Record<string, { count: number; value: number }> = {};
    for (const order of orders) {
      const key = order.createdAt.toISOString().slice(0, 7);
      const item = orderMonthMap[key] ?? { count: 0, value: 0 };
      item.count += 1;
      item.value += Number(order.totalClient);
      orderMonthMap[key] = item;
    }

    const orderByMonth = Object.entries(orderMonthMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([month, item]) => ({
        month: new Date(`${month}-01`).toLocaleDateString("fr-FR", {
          month: "short",
          year: "2-digit",
        }),
        count: item.count,
        value: Math.round(item.value),
      }));

    return {
      contacts: {
        total: totalContacts,
        clients: contactTypeMap.CLIENT ?? 0,
        prospects: contactTypeMap.PROSPECT ?? 0,
        suppliers: contactTypeMap.SUPPLIER ?? 0,
        others:
          totalContacts -
          (contactTypeMap.CLIENT ?? 0) -
          (contactTypeMap.PROSPECT ?? 0) -
          (contactTypeMap.SUPPLIER ?? 0),
        byType: contactByType,
        recent: contacts.slice(0, 8).map((contact) => ({
          id: contact.id,
          name: contact.name,
          company: contact.company ?? null,
          type: contact.type,
          city: contact.city ?? null,
          country: contact.country,
          createdAt: contact.createdAt,
        })),
        topClients,
      },
      leads: {
        total: leads.length,
        wonCount,
        lostCount,
        conversionRate: closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0,
        totalPipelineValue: Math.round(totalPipelineValue),
        byStatus: leadByStatus,
        byContainerType: leadByContainer,
        byOriginCountry: leadByOrigin,
        recent: leads.slice(0, 6).map((lead) => ({
          id: lead.id,
          contactName: lead.contact.name,
          company: lead.contact.company ?? null,
          status: lead.status,
          estimatedValue: lead.estimatedValue ? Number(lead.estimatedValue) : null,
          containerType: lead.containerType ?? null,
          originCountry: lead.originCountry ?? null,
          createdAt: lead.createdAt,
        })),
      },
      orders: {
        total: orders.length,
        recent90d,
        totalValue: Math.round(totalOrderValue),
        avgValue: orders.length > 0 ? Math.round(totalOrderValue / orders.length) : 0,
        byOriginCountry: orderByOrigin,
        byMonth: orderByMonth,
      },
    };
  } catch {
    return empty;
  }
}

export type MarketingPersona = {
  id: string;
  name: string;
  avatar: string;
  role: string;
  ageRange: string;
  location: string;
  companySize: string;
  sector: string;
  painPoints: string[];
  goals: string[];
  preferredPlatforms: string[];
  contentTypes: string[];
  budgetRange: string;
  buyingCycle: string;
};

const DEFAULT_PERSONAS: MarketingPersona[] = [
  {
    id: "persona-1",
    name: "Importateur PME",
    avatar: "shop",
    role: "Gerant / Directeur commercial",
    ageRange: "35-50",
    location: "Brazzaville / Pointe-Noire",
    companySize: "PME 5-50",
    sector: "Commerce de gros et detail",
    painPoints: ["Delais incertains", "Risque fournisseur", "Couts caches", "Qualite variable"],
    goals: ["Stabiliser les delais", "Reduire les risques", "Mieux negocier les prix"],
    preferredPlatforms: ["WHATSAPP", "FACEBOOK"],
    contentTypes: ["Temoignages", "Conseils pratiques", "Offres"],
    budgetRange: "5M-50M XAF",
    buyingCycle: "1-3 mois",
  },
  {
    id: "persona-2",
    name: "Decideur corporate",
    avatar: "briefcase",
    role: "DG / Directeur achats",
    ageRange: "40-55",
    location: "Brazzaville",
    companySize: "Entreprise 50+",
    sector: "BTP / Industrie / Distribution",
    painPoints: ["Conformite", "Risque operationnel", "Visibilite KPI", "Volume"],
    goals: ["Maitriser la chaine d'appro", "Standardiser SLA", "Seuil marge controle"],
    preferredPlatforms: ["LINKEDIN", "EMAIL"],
    contentTypes: ["Etudes de cas", "Rapports", "Webinars"],
    budgetRange: "50M-500M XAF",
    buyingCycle: "3-12 mois",
  },
];

function readPersonas(settings: JsonObject): MarketingPersona[] {
  const raw = Array.isArray(settings.marketingPersonas) ? settings.marketingPersonas : [];
  if (raw.length === 0) return DEFAULT_PERSONAS;
  return raw
    .map((item) => asObject(item))
    .map((item) => ({
      id: toOptionalString(item.id) ?? `persona-${Date.now()}`,
      name: toOptionalString(item.name) ?? "Persona",
      avatar: toOptionalString(item.avatar) ?? "user",
      role: toOptionalString(item.role) ?? "",
      ageRange: toOptionalString(item.ageRange) ?? "",
      location: toOptionalString(item.location) ?? "",
      companySize: toOptionalString(item.companySize) ?? "",
      sector: toOptionalString(item.sector) ?? "",
      painPoints: toStringArray(item.painPoints),
      goals: toStringArray(item.goals),
      preferredPlatforms: toStringArray(item.preferredPlatforms),
      contentTypes: toStringArray(item.contentTypes),
      budgetRange: toOptionalString(item.budgetRange) ?? "",
      buyingCycle: toOptionalString(item.buyingCycle) ?? "",
    }));
}

export async function getPersonas(): Promise<MarketingPersona[]> {
  try {
    const ctx = await getSessionContext();
    const settings = await getTenantSettings(ctx.tenantId);
    return readPersonas(settings);
  } catch {
    return DEFAULT_PERSONAS;
  }
}

export async function savePersona(persona: MarketingPersona): Promise<{ success?: boolean; error?: string }> {
  const authResult = await requireSessionContext();
  if (!authResult.ok) return { error: "Non authentifie" };
  const { ctx } = authResult;

  try {
    await updateTenantSettings(ctx.tenantId, (settings) => {
      const personas = readPersonas(settings);
      const exists = personas.some((item) => item.id === persona.id);
      const next = exists
        ? personas.map((item) => (item.id === persona.id ? persona : item))
        : [...personas, { ...persona, id: `persona-${Date.now()}` }];
      return { ...settings, marketingPersonas: next };
    });
    revalidatePath(MARKETING_PATH);
    return { success: true };
  } catch (error) {
    return { error: String(error) };
  }
}

export async function deletePersona(id: string): Promise<{ success?: boolean; error?: string }> {
  const authResult = await requireSessionContext();
  if (!authResult.ok) return { error: "Non authentifie" };
  const { ctx } = authResult;

  try {
    await updateTenantSettings(ctx.tenantId, (settings) => {
      const personas = readPersonas(settings).filter((item) => item.id !== id);
      return { ...settings, marketingPersonas: personas };
    });
    revalidatePath(MARKETING_PATH);
    return { success: true };
  } catch (error) {
    return { error: String(error) };
  }
}

export type MarketTrend = {
  id: string;
  title: string;
  description: string;
  category: "opportunite" | "menace" | "tendance" | "insight";
  impact: "high" | "medium" | "low";
  source: string;
  createdAt: string;
};

const DEFAULT_TRENDS: MarketTrend[] = [
  {
    id: "trend-1",
    title: "Demande import en hausse",
    description: "La demande locale continue de croitre sur les categories maison et equipement.",
    category: "opportunite",
    impact: "high",
    source: "Analyse Horion",
    createdAt: "2026-01-01",
  },
  {
    id: "trend-2",
    title: "Controle qualite plus exigeant",
    description: "Les clients demandent plus de preuve visuelle et de garanties pre-expedition.",
    category: "tendance",
    impact: "medium",
    source: "Feedback clients",
    createdAt: "2026-01-15",
  },
];

function readTrends(settings: JsonObject): MarketTrend[] {
  const raw = Array.isArray(settings.marketingTrends) ? settings.marketingTrends : [];
  if (raw.length === 0) return DEFAULT_TRENDS;

  return raw
    .map((item) => asObject(item))
    .map((item) => ({
      id: toOptionalString(item.id) ?? `trend-${Date.now()}`,
      title: toOptionalString(item.title) ?? "Trend",
      description: toOptionalString(item.description) ?? "",
      category:
        (toOptionalString(item.category) as MarketTrend["category"]) ?? "insight",
      impact: (toOptionalString(item.impact) as MarketTrend["impact"]) ?? "medium",
      source: toOptionalString(item.source) ?? "Interne",
      createdAt: toOptionalString(item.createdAt) ?? new Date().toISOString().slice(0, 10),
    }));
}

export async function getMarketTrends(): Promise<MarketTrend[]> {
  try {
    const ctx = await getSessionContext();
    const settings = await getTenantSettings(ctx.tenantId);
    return readTrends(settings);
  } catch {
    return DEFAULT_TRENDS;
  }
}

export async function saveMarketTrend(
  trend: Omit<MarketTrend, "id" | "createdAt">
): Promise<{ success?: boolean; error?: string }> {
  const authResult = await requireSessionContext();
  if (!authResult.ok) return { error: "Non authentifie" };
  const { ctx } = authResult;

  try {
    await updateTenantSettings(ctx.tenantId, (settings) => {
      const trends = readTrends(settings);
      const newTrend: MarketTrend = {
        ...trend,
        id: `trend-${Date.now()}`,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      return { ...settings, marketingTrends: [...trends, newTrend] };
    });
    revalidatePath(MARKETING_PATH);
    return { success: true };
  } catch (error) {
    return { error: String(error) };
  }
}

export async function deleteMarketTrend(id: string): Promise<{ success?: boolean; error?: string }> {
  const authResult = await requireSessionContext();
  if (!authResult.ok) return { error: "Non authentifie" };
  const { ctx } = authResult;

  try {
    await updateTenantSettings(ctx.tenantId, (settings) => {
      const trends = readTrends(settings).filter((item) => item.id !== id);
      return { ...settings, marketingTrends: trends };
    });
    revalidatePath(MARKETING_PATH);
    return { success: true };
  } catch (error) {
    return { error: String(error) };
  }
}

export type EmailCampaignItem = {
  id: string;
  name: string;
  subject: string;
  fromName: string | null;
  status: string;
  scheduledAt: Date | null;
  sentAt: Date | null;
  segments: unknown;
  stats: unknown;
  createdAt: Date;
  _count: { recipients: number };
};

async function sendWithResend(payload: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<string | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json().catch(() => ({}))) as {
    id?: string;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(body.error?.message ?? `Resend HTTP ${response.status}`);
  }
  return toOptionalString(body.id);
}

export async function getEmailCampaigns(): Promise<{ data?: EmailCampaignItem[]; error?: string }> {
  try {
    const ctx = await getSessionContext();
    const campaigns = await prisma.emailCampaign.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { recipients: true } } },
    });
    return { data: campaigns as EmailCampaignItem[] };
  } catch (error) {
    return { error: String(error) };
  }
}

export async function createEmailCampaign(data: {
  name: string;
  subject: string;
  fromName?: string;
  htmlContent: string;
  textContent?: string;
  segments?: string[];
}): Promise<{ data?: EmailCampaignItem; error?: string }> {
  const authResult = await requireSessionContext();
  if (!authResult.ok) return { error: "Non authentifie" };
  const { ctx } = authResult;

  try {
    const campaign = await prisma.emailCampaign.create({
      data: {
        tenantId: ctx.tenantId,
        name: data.name.trim(),
        subject: data.subject.trim(),
        fromName: toOptionalString(data.fromName),
        htmlContent: data.htmlContent,
        textContent: toOptionalString(data.textContent),
        segments: (data.segments ?? []) as Prisma.InputJsonValue,
        createdById: ctx.userId,
      },
      include: { _count: { select: { recipients: true } } },
    });
    revalidatePath(MARKETING_PATH);
    return { data: campaign as EmailCampaignItem };
  } catch (error) {
    return { error: String(error) };
  }
}

export async function sendEmailCampaign(
  campaignId: string
): Promise<{ data?: { sent: number; errors: number }; error?: string }> {
  const authResult = await requireSessionContext();
  if (!authResult.ok) return { error: "Non authentifie" };
  const { ctx } = authResult;

  try {
    const campaign = await prisma.emailCampaign.findUnique({
      where: { id: campaignId },
      include: {
        recipients: {
          include: {
            contact: { select: { email: true, name: true } },
          },
        },
      },
    });

    if (!campaign || campaign.tenantId !== ctx.tenantId) {
      return { error: "Campagne introuvable" };
    }
    if (campaign.status === "SENT") {
      return { error: "Campagne deja envoyee" };
    }

    let recipients = campaign.recipients;
    if (recipients.length === 0) {
      const contacts = await prisma.contact.findMany({
        where: { tenantId: ctx.tenantId, email: { not: null } },
        select: { id: true, email: true },
        take: 1000,
      });

      if (contacts.length > 0) {
        await prisma.emailRecipient.createMany({
          data: contacts.map((contact) => ({
            campaignId,
            contactId: contact.id,
            email: contact.email!,
            status: "PENDING",
          })),
          skipDuplicates: true,
        });
      }

      recipients = await prisma.emailRecipient.findMany({
        where: { campaignId },
        include: { contact: { select: { email: true, name: true } } },
      });
    }

    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: "SENDING" },
    });

    const fromAddress = process.env.EMAIL_FROM ?? "noreply@horion.cg";
    const from = campaign.fromName ? `${campaign.fromName} <${fromAddress}>` : fromAddress;

    let sent = 0;
    let errors = 0;

    for (const recipient of recipients) {
      try {
        await sendWithResend({
          from,
          to: recipient.email,
          subject: campaign.subject,
          html: campaign.htmlContent,
          text: campaign.textContent ?? undefined,
        });

        await prisma.emailRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
          },
        });
        sent += 1;
      } catch {
        await prisma.emailRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "BOUNCED",
            bouncedAt: new Date(),
          },
        });
        errors += 1;
      }
    }

    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: "SENT",
        sentAt: new Date(),
        stats: { sent, errors, opened: 0, clicked: 0 } as Prisma.InputJsonValue,
      },
    });

    revalidatePath(MARKETING_PATH);
    return { data: { sent, errors } };
  } catch (error) {
    return { error: String(error) };
  }
}

export async function deleteEmailCampaign(id: string): Promise<{ success?: boolean; error?: string }> {
  const authResult = await requireSessionContext();
  if (!authResult.ok) return { error: "Non authentifie" };
  const { ctx } = authResult;

  try {
    const result = await prisma.emailCampaign.deleteMany({
      where: { id, tenantId: ctx.tenantId },
    });
    if (result.count === 0) return { error: "Campagne introuvable" };
    revalidatePath(MARKETING_PATH);
    return { success: true };
  } catch (error) {
    return { error: String(error) };
  }
}

export async function publishContentPost(
  postId: string,
  channels: string[]
): Promise<{ data?: { published: string[]; errors: string[] }; error?: string }> {
  const authResult = await requireSessionContext();
  if (!authResult.ok) return { error: "Non authentifie" };
  const { ctx } = authResult;

  try {
    const post = await prisma.contentPost.findUnique({ where: { id: postId } });
    if (!post) return { error: "Post introuvable" };

    const normalized = normalizePlatforms(channels, post.format);
    const socialAccounts = await prisma.socialAccount.findMany({
      where: { platform: { in: normalized } },
    });

    const accountsByPlatform = new Map<
      string,
      Prisma.SocialAccountGetPayload<Record<string, never>>
    >(
      socialAccounts.map((account) => [account.platform.toUpperCase(), account])
    );

    const published: string[] = [];
    const errors: string[] = [];

    for (const channel of normalized) {
      const account = accountsByPlatform.get(channel);
      if (!account) {
        errors.push(`${channel}: compte non configure`);
        continue;
      }

      const accessToken = resolveAccessToken(account.postingRules);
      const textPayload = post.body ?? post.title ?? "";

      if (channel === "FACEBOOK") {
        if (!account.pageId || !accessToken) {
          errors.push(`${channel}: page ou token manquant`);
          continue;
        }

        const response = await fetch(`https://graph.facebook.com/v17.0/${account.pageId}/feed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: textPayload,
            access_token: accessToken,
          }),
        });

        if (!response.ok) {
          errors.push(`${channel}: echec publication`);
          continue;
        }

        published.push(channel);
        continue;
      }

      if (channel === "INSTAGRAM") {
        if (!account.pageId || !accessToken) {
          errors.push(`${channel}: page ou token manquant`);
          continue;
        }

        const mediaResponse = await fetch(
          `https://graph.facebook.com/v17.0/${account.pageId}/media`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              caption: textPayload,
              media_type: "IMAGE",
              access_token: accessToken,
            }),
          }
        );

        if (!mediaResponse.ok) {
          errors.push(`${channel}: echec creation media`);
          continue;
        }

        const mediaBody = (await mediaResponse.json().catch(() => ({}))) as { id?: string };
        if (!mediaBody.id) {
          errors.push(`${channel}: reponse invalide`);
          continue;
        }

        const publishResponse = await fetch(
          `https://graph.facebook.com/v17.0/${account.pageId}/media_publish`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              creation_id: mediaBody.id,
              access_token: accessToken,
            }),
          }
        );

        if (!publishResponse.ok) {
          errors.push(`${channel}: echec publication`);
          continue;
        }

        published.push(channel);
        continue;
      }

      if (!NATIVE_CONTENT_CHANNELS.has(channel)) {
        errors.push(`${channel}: canal non integre`);
        continue;
      }

      errors.push(`${channel}: integration non disponible`);
    }

    if (published.length > 0) {
      const now = new Date();
      await prisma.contentPost.update({
        where: { id: postId },
        data: { status: "published", publishedAt: now },
      });

      const channelIds = await prisma.channel.findMany({
        where: { tenantId: ctx.tenantId, platform: { in: published } },
        select: { id: true },
      });

      if (channelIds.length > 0) {
        await prisma.publishingQueue.updateMany({
          where: {
            postId,
            channelId: { in: channelIds.map((channel) => channel.id) },
            publishedAt: null,
          },
          data: {
            publishedAt: now,
            result: "ok",
          },
        });
      }

      revalidatePath(MARKETING_PATH);
    }

    return { data: { published, errors } };
  } catch (error) {
    return { error: String(error) };
  }
}

