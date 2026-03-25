import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convertit récursivement les objets Prisma Decimal en number.
 * Nécessaire pour passer des données Server Component → Client Component.
 */
export function serializeDecimals<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "object" && "toFixed" in obj && typeof (obj as any).toFixed === "function") {
    return Number(obj) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(serializeDecimals) as unknown as T;
  }
  if (typeof obj === "object" && !(obj instanceof Date)) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, serializeDecimals(v)])
    ) as T;
  }
  return obj;
}

export function toPlainData<T>(obj: T): T {
  return JSON.parse(JSON.stringify(serializeDecimals(obj))) as T;
}

export function formatDate(date: Date | string, includeTime = false): string {
  const d = typeof date === "string" ? new Date(date) : date;

  if (includeTime) {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(d);
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
  }).format(d);
}
