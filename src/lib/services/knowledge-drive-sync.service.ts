import { createSign } from "crypto";

import type { KnowledgeAudience, KnowledgeSourceType } from "@prisma/client";

import { prisma } from "@/lib/db";

const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_API_BASE = "https://www.googleapis.com/drive/v3/files";
const DEFAULT_CHUNK_SIZE = 1400;
const DEFAULT_SYNC_MAX_AGE_MINUTES = 360;
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

type DriveKnowledgeSourceConfig = {
  fileId?: string;
  folderId?: string;
  sourceUrl?: string;
  title?: string;
  module?: string | null;
  audience?: KnowledgeAudience;
  tags?: string[];
  chunkSize?: number;
  externalRef?: string;
  status?: string;
};

type NormalizedKnowledgeSource = DriveKnowledgeSourceConfig & {
  audience: KnowledgeAudience;
  tags: string[];
  status: string;
};

type GoogleFileMetadata = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string | null;
  modifiedTime?: string | null;
};

type SyncedKnowledgeDocument = {
  title: string;
  module: string | null;
  audience: KnowledgeAudience;
  tags: string[];
  content: string;
  sourceUrl: string | null;
  externalRef: string;
  chunkSize: number;
  status: string;
  sourceType: KnowledgeSourceType;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function base64UrlEncode(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function normalizeText(content: string) {
  return content.replace(/\r\n/g, "\n").replace(/\u0000/g, "").trim();
}

function splitIntoChunks(content: string, maxLength = DEFAULT_CHUNK_SIZE) {
  const paragraphs = normalizeText(content)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return [];

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxLength) {
      if (current) {
        chunks.push(current.trim());
        current = "";
      }

      for (let index = 0; index < paragraph.length; index += maxLength) {
        chunks.push(paragraph.slice(index, index + maxLength).trim());
      }
      continue;
    }

    const nextCandidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (nextCandidate.length > maxLength && current) {
      chunks.push(current.trim());
      current = paragraph;
      continue;
    }

    current = nextCandidate;
  }

  if (current) chunks.push(current.trim());
  return chunks;
}

function parseJsonEnv<T>(value: string | undefined, fallback: T): T {
  if (!value?.trim()) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function extractDriveFileId(url?: string | null) {
  if (!url) return undefined;
  const patterns = [
    /\/d\/([a-zA-Z0-9_-]{10,})/,
    /[?&]id=([a-zA-Z0-9_-]{10,})/,
    /\/folders\/([a-zA-Z0-9_-]{10,})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }

  return undefined;
}

async function getTenantDriveSources(tenantId: string): Promise<NormalizedKnowledgeSource[]> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });

  const settings = isRecord(tenant?.settings) ? tenant.settings : {};
  const rawFromSettings = Array.isArray(settings.zeliaInternalDriveSources)
    ? settings.zeliaInternalDriveSources
    : parseJsonEnv<unknown[]>(process.env.ZELIA_INTERNAL_DRIVE_SOURCES_JSON, []);

  return rawFromSettings
    .filter(isRecord)
    .map((item) => ({
      fileId:
        typeof item.fileId === "string" && item.fileId.trim()
          ? item.fileId.trim()
          : extractDriveFileId(typeof item.sourceUrl === "string" ? item.sourceUrl : undefined),
      folderId:
        typeof item.folderId === "string" && item.folderId.trim()
          ? item.folderId.trim()
          : undefined,
      sourceUrl: typeof item.sourceUrl === "string" && item.sourceUrl.trim() ? item.sourceUrl.trim() : undefined,
      title: typeof item.title === "string" && item.title.trim() ? item.title.trim() : undefined,
      module: typeof item.module === "string" && item.module.trim() ? item.module.trim() : null,
      audience: (item.audience === "PUBLIC" ? "PUBLIC" : "INTERNAL") as KnowledgeAudience,
      tags: Array.isArray(item.tags) ? item.tags.map((tag) => String(tag)).filter(Boolean) : [],
      chunkSize:
        typeof item.chunkSize === "number" && Number.isFinite(item.chunkSize) && item.chunkSize >= 300
          ? item.chunkSize
          : DEFAULT_CHUNK_SIZE,
      externalRef:
        typeof item.externalRef === "string" && item.externalRef.trim() ? item.externalRef.trim() : undefined,
      status: typeof item.status === "string" && item.status.trim() ? item.status.trim() : "ACTIVE",
    }))
    .filter((item) => item.fileId || item.folderId || item.sourceUrl)
    .map((item) => ({
      ...item,
      audience: (item.audience ?? "INTERNAL") as KnowledgeAudience,
      tags: item.tags ?? [],
      status: item.status ?? "ACTIVE",
    }));
}

function getServiceAccountCredentials() {
  const email = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();

  if (!email || !privateKey) return null;
  return { email, privateKey };
}

async function getGoogleAccessToken() {
  const credentials = getServiceAccountCredentials();
  if (!credentials) return null;

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: credentials.email,
      scope: DRIVE_SCOPE,
      aud: GOOGLE_OAUTH_TOKEN_URL,
      exp: now + 3600,
      iat: now,
    })
  );

  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(credentials.privateKey);
  const assertion = `${unsigned}.${base64UrlEncode(signature)}`;

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new Error(`Echec auth Google Drive (${response.status})`);
  }

  const payloadJson = (await response.json()) as { access_token?: string };
  if (!payloadJson.access_token) {
    throw new Error("Token Google Drive manquant");
  }

  return payloadJson.access_token;
}

async function googleDriveRequest<T>(path: string, init?: RequestInit, accessToken?: string | null): Promise<T> {
  if (!accessToken) {
    throw new Error("Configuration Google Drive manquante");
  }

  const response = await fetch(`${GOOGLE_DRIVE_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Google Drive API error (${response.status})`);
  }

  return (await response.json()) as T;
}

async function googleDriveTextRequest(path: string, accessToken?: string | null) {
  if (!accessToken) {
    throw new Error("Configuration Google Drive manquante");
  }

  const response = await fetch(`${GOOGLE_DRIVE_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Google Drive export error (${response.status})`);
  }

  return normalizeText(await response.text());
}

async function listGoogleDriveFolder(folderId: string, accessToken?: string | null) {
  const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const fields = encodeURIComponent("files(id,name,mimeType,webViewLink,modifiedTime)");
  const payload = await googleDriveRequest<{ files?: GoogleFileMetadata[] }>(
    `?q=${query}&fields=${fields}&pageSize=200&includeItemsFromAllDrives=true&supportsAllDrives=true`,
    undefined,
    accessToken
  );

  return payload.files ?? [];
}

async function getGoogleDriveMetadata(fileId: string, accessToken?: string | null) {
  const fields = encodeURIComponent("id,name,mimeType,webViewLink,modifiedTime");
  return googleDriveRequest<GoogleFileMetadata>(
    `/${fileId}?fields=${fields}&includeItemsFromAllDrives=true&supportsAllDrives=true`,
    undefined,
    accessToken
  );
}

async function getGoogleDriveContent(metadata: GoogleFileMetadata, accessToken?: string | null) {
  if (metadata.mimeType === "application/vnd.google-apps.document") {
    return googleDriveTextRequest(
      `/${metadata.id}/export?mimeType=${encodeURIComponent("text/plain")}`,
      accessToken
    );
  }

  if (
    metadata.mimeType.startsWith("text/") ||
    metadata.mimeType === "application/json" ||
    metadata.mimeType === "application/xml"
  ) {
    return googleDriveTextRequest(
      `/${metadata.id}?alt=media&includeItemsFromAllDrives=true&supportsAllDrives=true`,
      accessToken
    );
  }

  throw new Error(`Type de fichier Drive non supporte: ${metadata.mimeType}`);
}

async function fetchDirectTextSource(url: string) {
  const response = await fetch(url, {
    headers: { Accept: "text/plain, text/markdown, text/*, application/json;q=0.8, */*;q=0.5" },
  });

  if (!response.ok) {
    throw new Error(`Source distante inaccessible (${response.status})`);
  }

  return normalizeText(await response.text());
}

async function resolveDriveSources(tenantId: string) {
  const sources = await getTenantDriveSources(tenantId);
  if (sources.length === 0) return [];

  const accessToken = await getGoogleAccessToken().catch(() => null);
  const resolved: SyncedKnowledgeDocument[] = [];

  for (const source of sources) {
    if (source.folderId) {
      if (!accessToken) continue;
      const files = await listGoogleDriveFolder(source.folderId, accessToken).catch(() => []);
      for (const file of files) {
        try {
          const content = await getGoogleDriveContent(file, accessToken);
          if (!content) continue;
          resolved.push({
            title: file.name,
            module: source.module ?? null,
            audience: source.audience,
            tags: source.tags,
            content,
            sourceUrl: file.webViewLink ?? source.sourceUrl ?? null,
            externalRef: source.externalRef ? `${source.externalRef}:${file.id}` : `drive:file:${file.id}`,
            chunkSize: source.chunkSize ?? DEFAULT_CHUNK_SIZE,
            status: source.status,
            sourceType: "DRIVE",
          });
        } catch {
          continue;
        }
      }
      continue;
    }

    if (source.fileId && accessToken) {
      try {
        const metadata = await getGoogleDriveMetadata(source.fileId, accessToken);
        const content = await getGoogleDriveContent(metadata, accessToken);
        if (!content) continue;
        resolved.push({
          title: source.title ?? metadata.name,
          module: source.module ?? null,
          audience: source.audience,
          tags: source.tags,
          content,
          sourceUrl: metadata.webViewLink ?? source.sourceUrl ?? null,
          externalRef: source.externalRef ?? `drive:file:${metadata.id}`,
          chunkSize: source.chunkSize ?? DEFAULT_CHUNK_SIZE,
          status: source.status,
          sourceType: "DRIVE",
        });
        continue;
      } catch {
        // fall through to direct URL mode if available
      }
    }

    if (source.sourceUrl) {
      try {
        const content = await fetchDirectTextSource(source.sourceUrl);
        if (!content) continue;
        resolved.push({
          title: source.title ?? source.sourceUrl,
          module: source.module ?? null,
          audience: source.audience,
          tags: source.tags,
          content,
          sourceUrl: source.sourceUrl ?? null,
          externalRef: source.externalRef ?? `url:${source.sourceUrl}`,
          chunkSize: source.chunkSize ?? DEFAULT_CHUNK_SIZE,
          status: source.status,
          sourceType: "DRIVE",
        });
      } catch {
        continue;
      }
    }
  }

  return resolved;
}

export class KnowledgeDriveSyncService {
  static async hasConfiguredSources(tenantId: string) {
    const sources = await getTenantDriveSources(tenantId);
    return sources.length > 0;
  }

  static async ensureFresh(tenantId: string, maxAgeMinutes = DEFAULT_SYNC_MAX_AGE_MINUTES) {
    const hasSources = await this.hasConfiguredSources(tenantId);
    if (!hasSources) {
      return { synced: 0, chunks: 0, skipped: true, reason: "no_sources" };
    }

    const freshnessCutoff = new Date(Date.now() - maxAgeMinutes * 60_000);
    const freshCount = await prisma.knowledgeDocument.count({
      where: {
        tenantId,
        audience: "INTERNAL",
        sourceType: "DRIVE",
        updatedAt: { gte: freshnessCutoff },
      },
    });

    if (freshCount > 0) {
      return { synced: 0, chunks: 0, skipped: true, reason: "fresh" };
    }

    return this.syncTenantInternalKnowledge(tenantId);
  }

  static async syncTenantInternalKnowledge(tenantId: string) {
    const documents = await resolveDriveSources(tenantId);
    if (documents.length === 0) {
      return { synced: 0, chunks: 0, skipped: true, reason: "empty" };
    }

    let synced = 0;
    let chunks = 0;

    for (const source of documents) {
      const existing = await prisma.knowledgeDocument.findFirst({
        where: {
          tenantId,
          audience: source.audience,
          OR: [{ externalRef: source.externalRef }, { title: source.title }],
        },
        select: { id: true },
      });

      const document = existing
        ? await prisma.knowledgeDocument.update({
            where: { id: existing.id },
            data: {
              sourceType: source.sourceType,
              title: source.title,
              slug: toSlug(source.title),
              module: source.module,
              sourceUrl: source.sourceUrl,
              externalRef: source.externalRef,
              tags: source.tags,
              content: source.content,
              status: source.status,
            },
            select: { id: true },
          })
        : await prisma.knowledgeDocument.create({
            data: {
              tenantId,
              audience: source.audience,
              sourceType: source.sourceType,
              title: source.title,
              slug: toSlug(source.title),
              module: source.module,
              sourceUrl: source.sourceUrl,
              externalRef: source.externalRef,
              tags: source.tags,
              content: source.content,
              status: source.status,
            },
            select: { id: true },
          });

      const chunkPayload = splitIntoChunks(source.content, source.chunkSize).map((content, ordinal) => ({
        documentId: document.id,
        ordinal,
        module: source.module,
        content,
        tags: source.tags,
        metadata: {
          sourceType: source.sourceType,
          sourceUrl: source.sourceUrl,
          externalRef: source.externalRef,
        },
      }));

      await prisma.$transaction(async (tx) => {
        await tx.knowledgeChunk.deleteMany({ where: { documentId: document.id } });
        if (chunkPayload.length > 0) {
          await tx.knowledgeChunk.createMany({
            data: chunkPayload.map((chunk) => ({
              ...chunk,
              tags: chunk.tags as any,
              metadata: chunk.metadata as any,
            })),
          });
        }
      });

      synced += 1;
      chunks += chunkPayload.length;
    }

    return { synced, chunks, skipped: false, reason: null };
  }
}
