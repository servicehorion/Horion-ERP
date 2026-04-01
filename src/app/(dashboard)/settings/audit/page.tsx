import Link from "next/link";
import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { getAuditLogs, type AuditFilters } from "@/lib/actions/audit.actions";
import { AuditExportButton } from "@/components/settings/audit-export-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Audit Logs | Horion ERP" };

const getParam = (params: Record<string, string | string[] | undefined>, key: string) => {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
};

const MODULES = [
  "crm",
  "orders",
  "sourcing",
  "logistics",
  "finance",
  "whatsapp",
  "marketing",
  "tasks",
  "project",
  "catalog",
];

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSession();
  checkPermission(user.role, "user.manage");
  const resolvedSearchParams = await searchParams;

  const filters: AuditFilters = {
    module: getParam(resolvedSearchParams, "module"),
    userId: getParam(resolvedSearchParams, "userId"),
    action: getParam(resolvedSearchParams, "action"),
    from: getParam(resolvedSearchParams, "from"),
    to: getParam(resolvedSearchParams, "to"),
    page: Number(getParam(resolvedSearchParams, "page") || 1),
    pageSize: Number(getParam(resolvedSearchParams, "pageSize") || 50),
  };

  const [logsRes, users] = await Promise.all([
    getAuditLogs(filters),
    prisma.user.findMany({
      where: { tenantId: user.tenantId },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const logs = logsRes.data ?? [];
  const total = logsRes.total ?? 0;
  const page = logsRes.page ?? 1;
  const pageSize = logsRes.pageSize ?? 50;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const buildHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (filters.module) params.set("module", filters.module);
    if (filters.userId) params.set("userId", filters.userId);
    if (filters.action) params.set("action", filters.action);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    params.set("page", String(nextPage));
    params.set("pageSize", String(pageSize));
    return `/settings/audit?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Audit Logs</h1>
          <p className="text-muted-foreground">Traçabilité des actions critiques</p>
        </div>
        <AuditExportButton filters={filters} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 md:grid-cols-6 gap-3" method="get">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Module</label>
              <select
                name="module"
                defaultValue={filters.module || ""}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Tous</option>
                {MODULES.map((mod) => (
                  <option key={mod} value={mod}>
                    {mod.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Utilisateur</label>
              <select
                name="userId"
                defaultValue={filters.userId || ""}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Tous</option>
                {users.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name || member.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Action</label>
              <Input name="action" defaultValue={filters.action || ""} placeholder="ORDER_CREATED" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">De</label>
              <Input type="date" name="from" defaultValue={filters.from || ""} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">A</label>
              <Input type="date" name="to" defaultValue={filters.to || ""} />
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit">Filtrer</Button>
              <Link href="/settings/audit">
                <Button type="button" variant="ghost">Réinitialiser</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evenements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Module</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Détails</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString("fr-FR")}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{log.user?.name || log.user?.email || "-"}</div>
                      <div className="text-xs text-muted-foreground">{log.userId || "-"}</div>
                    </TableCell>
                    <TableCell className="text-sm">{log.action}</TableCell>
                    <TableCell className="text-sm">{log.entityType}</TableCell>
                    <TableCell className="font-mono text-xs">{log.entityId}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate">
                      {log.newValue ? JSON.stringify(log.newValue) : log.oldValue ? JSON.stringify(log.oldValue) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
                {logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      Aucun log
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {page} / {totalPages} — {total} evenement(s)
            </span>
            <div className="flex items-center gap-2">
              <Link href={buildHref(Math.max(1, page - 1))}>
                <Button variant="outline" size="sm" disabled={page <= 1}>
                  Precedent
                </Button>
              </Link>
              <Link href={buildHref(Math.min(totalPages, page + 1))}>
                <Button variant="outline" size="sm" disabled={page >= totalPages}>
                  Suivant
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
