import { randomUUID, createHash } from "crypto";

type UploadResult = {
  bucket: string;
  path: string;
  size?: number;
  mimeType?: string;
  publicUrl?: string;
};

type UploadKind = "document" | "image" | "video" | "any";

const DEFAULT_DOC_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
];

const DEFAULT_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const DEFAULT_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

function encodePath(path: string) {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

export class StorageService {
  private static supabaseUrl = process.env.SUPABASE_URL;
  private static supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  private static defaultBucket = process.env.SUPABASE_STORAGE_BUCKET || "horion-documents";
  private static publicUploads = process.env.SUPABASE_STORAGE_PUBLIC === "true";

  static ensureConfigured() {
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error("Stockage non configure (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
    }
  }

  static isPublicUploads() {
    return this.publicUploads;
  }

  static assertPrivateUploads() {
    if (this.publicUploads && process.env.ALLOW_PUBLIC_UPLOADS !== "true") {
      throw new Error("Uploads publics interdits. Desactivez SUPABASE_STORAGE_PUBLIC.");
    }
  }

  static validateUpload(params: { filename: string; mimeType?: string | null; size?: number; kind?: UploadKind }) {
    const kind = params.kind ?? "document";
    const size = params.size ?? 0;
    const mimeType = (params.mimeType || "").toLowerCase();

    const maxMbEnv =
      kind === "image"
        ? process.env.UPLOAD_MAX_MB_IMAGE || process.env.UPLOAD_MAX_MB
        : kind === "video"
          ? process.env.UPLOAD_MAX_MB_VIDEO || process.env.UPLOAD_MAX_MB
        : process.env.UPLOAD_MAX_MB;
    const maxMb = Number(maxMbEnv || (kind === "image" ? 5 : kind === "video" ? 50 : 20));
    const maxBytes = maxMb * 1024 * 1024;

    if (!params.filename || params.filename.trim().length === 0) {
      throw new Error("Nom de fichier invalide");
    }

    if (!mimeType) {
      throw new Error("Type de fichier manquant");
    }

    const allowedTypes =
      kind === "image"
        ? DEFAULT_IMAGE_TYPES
        : kind === "video"
          ? DEFAULT_VIDEO_TYPES
        : kind === "any"
          ? [...DEFAULT_DOC_TYPES, ...DEFAULT_IMAGE_TYPES, ...DEFAULT_VIDEO_TYPES]
          : DEFAULT_DOC_TYPES;

    if (!allowedTypes.includes(mimeType)) {
      throw new Error(`Type de fichier non autorise: ${mimeType}`);
    }

    if (size <= 0 || size > maxBytes) {
      throw new Error(`Taille de fichier invalide (max ${maxMb} MB)`);
    }
  }

  static async scanBufferIfEnabled(params: {
    buffer: Buffer;
    filename: string;
    mimeType?: string | null;
    size?: number;
  }) {
    const scanUrl = process.env.FILE_SCAN_WEBHOOK_URL;
    if (!scanUrl) return { ok: true, skipped: true };

    const hash = createHash("sha256").update(params.buffer).digest("hex");
    const payload = {
      filename: params.filename,
      mimeType: params.mimeType || null,
      size: params.size || params.buffer.length,
      sha256: hash,
    };

    const res = await fetch(scanUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.FILE_SCAN_WEBHOOK_TOKEN
          ? { Authorization: `Bearer ${process.env.FILE_SCAN_WEBHOOK_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Scan antivirus echoue: ${res.status} ${text}`);
    }

    const json = await res.json().catch(() => ({}));
    if (json?.status && String(json.status).toLowerCase() !== "clean") {
      throw new Error("Fichier bloque par antivirus");
    }

    return { ok: true, result: json };
  }

  static buildObjectPath(parts: string[], filename: string) {
    const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    return [...parts, `${Date.now()}-${randomUUID()}-${safeName}`].join("/");
  }

  static parseStorageRef(value?: string | null) {
    if (!value || !value.startsWith("storage://")) return null;
    const trimmed = value.replace("storage://", "");
    const [bucket, ...rest] = trimmed.split("/");
    if (!bucket || rest.length === 0) return null;
    return { bucket, path: rest.join("/") };
  }

  static async createDownloadUrl(value?: string | null, expiresIn = 3600) {
    const ref = this.parseStorageRef(value);
    if (!ref) return value ?? null;
    return this.createSignedUrl({
      bucket: ref.bucket,
      path: ref.path,
      expiresIn,
    });
  }

  static async upload(params: {
    bucket?: string;
    path: string;
    data: Buffer | ArrayBuffer | Uint8Array;
    contentType?: string;
  }): Promise<UploadResult> {
    this.ensureConfigured();
    const bucket = params.bucket || this.defaultBucket;
    const url = `${this.supabaseUrl}/storage/v1/object/${bucket}/${encodePath(params.path)}`;

    const body =
      params.data instanceof ArrayBuffer
        ? Buffer.from(params.data)
        : params.data instanceof Uint8Array
          ? Buffer.from(params.data)
          : params.data;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.supabaseKey}`,
        "Content-Type": params.contentType || "application/octet-stream",
        "x-upsert": "true",
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Upload storage failed: ${res.status} ${text}`);
    }

    const publicUrl = this.publicUploads
      ? `${this.supabaseUrl}/storage/v1/object/public/${bucket}/${encodePath(params.path)}`
      : undefined;

    return {
      bucket,
      path: params.path,
      publicUrl,
    };
  }

  static async createSignedUrl(params: { bucket?: string; path: string; expiresIn?: number }) {
    this.ensureConfigured();
    const bucket = params.bucket || this.defaultBucket;
    const url = `${this.supabaseUrl}/storage/v1/object/sign/${bucket}/${encodePath(params.path)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.supabaseKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: params.expiresIn ?? 3600 }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Signed URL failed: ${res.status} ${text}`);
    }

    const json = await res.json();
    return `${this.supabaseUrl}/storage/v1${json.signedURL}`;
  }

  static async deleteObject(params: { bucket?: string; path: string }) {
    this.ensureConfigured();
    const bucket = params.bucket || this.defaultBucket;
    const url = `${this.supabaseUrl}/storage/v1/object/${bucket}/${encodePath(params.path)}`;

    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${this.supabaseKey}`,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Delete storage failed: ${res.status} ${text}`);
    }
  }
}
