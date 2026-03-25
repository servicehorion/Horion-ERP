"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";

const parseDate = (value?: string) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export type AuditFilters = {
  module?: string;
  userId?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

const buildWhere = (tenantId: string, filters: AuditFilters): Prisma.AuditLogWhereInput => {
  const where: Prisma.AuditLogWhereInput = { tenantId };
  if (filters.userId) where.userId = filters.userId;
  if (filters.module) where.entityType = filters.module;
  if (filters.action) where.action = { contains: filters.action, mode: "insensitive" };

  const from = parseDate(filters.from);
  const to = parseDate(filters.to);
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  return where;
};

export async function getAuditLogs(filters: AuditFilters) {
  const user = await getSession();
  checkPermission(user.role, "user.manage");

  const page = clamp(Number(filters.page || 1), 1, 9999);
  const pageSize = clamp(Number(filters.pageSize || 50), 10, 200);
  const where = buildWhere(user.tenantId, filters);

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { data: rows, total, page, pageSize };
}

const csvValue = (value: unknown) => {
  if (value === null || value === undefined) return "";
  const str = typeof value === "string" ? value : JSON.stringify(value);
  return `"${str.replace(/"/g, '""')}"`;
};

export async function exportAuditCSV(filters: AuditFilters = {}) {
  const user = await getSession();
  checkPermission(user.role, "user.manage");

  const where = buildWhere(user.tenantId, filters);
  const rows = await prisma.auditLog.findMany({
    where,
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const header = [
    "date",
    "user",
    "action",
    "entity_type",
    "entity_id",
    "old_value",
    "new_value",
    "ip_address",
  ];

  const lines = rows.map((log) => [
    csvValue(log.createdAt.toISOString()),
    csvValue(log.user?.name || log.user?.email || log.userId || ""),
    csvValue(log.action),
    csvValue(log.entityType),
    csvValue(log.entityId),
    csvValue(log.oldValue ?? ""),
    csvValue(log.newValue ?? ""),
    csvValue(log.ipAddress ?? ""),
  ]);

  const csv = [header.join(","), ...lines.map((line) => line.join(","))].join("\n");
  return { data: csv };
}
