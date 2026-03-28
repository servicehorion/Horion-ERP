"use client";

import { useState, useTransition } from "react";
import { Search, RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard, KpiGrid } from "@/components/shared/kpi-card";
import { getAuditLogs } from "@/lib/actions/audit.actions";

type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: Date;
  userId: string | null;
  user: { name: string; email: string } | null;
  oldValue: unknown;
  newValue: unknown;
};

type Props = {
  initialLogs: AuditLog[];
  initialTotal: number;
  entityTypes: string[];
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-100",
  update: "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-100",
  delete: "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-100",
  invite: "bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-100",
  activate: "bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-100",
  deactivate: "bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-100",
  approve: "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-100",
};

function getActionColor(action: string) {
  const verb = action.split(".").pop() ?? action;
  return (
    ACTION_COLORS[verb] ||
    "bg-gray-100 text-gray-800 dark:bg-gray-800/60 dark:text-gray-100"
  );
}

function formatDateTime(d: Date) {
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PAGE_SIZE = 50;

export function AuditLogViewer({ initialLogs, initialTotal, entityTypes }: Props) {
  const [logs, setLogs] = useState<AuditLog[]>(initialLogs);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState({
    entityType: "",
    action: "",
  });

  function fetchLogs(p: number, f: typeof filters) {
    startTransition(async () => {
      const res = await getAuditLogs({
        entityType: f.entityType || undefined,
        action: f.action || undefined,
        page: p,
        pageSize: PAGE_SIZE,
      });
      if (res.data) {
        setLogs(res.data.logs as AuditLog[]);
        setTotal(res.data.total);
        setPage(p);
      }
    });
  }

  function handleFilterChange(key: keyof typeof filters, value: string) {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    fetchLogs(1, newFilters);
  }

  function exportCsv() {
    const rows = [
      ["Date", "Utilisateur", "Action", "Entité", "ID Entité"],
      ...logs.map((l) => [
        formatDateTime(l.createdAt),
        l.user?.name ?? l.userId ?? "Système",
        l.action,
        l.entityType,
        l.entityId,
      ]),
    ];
    const csv = rows.map((r) => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const todayCount = logs.filter(
    (l) =>
      new Date(l.createdAt).toDateString() === new Date().toDateString()
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journaux d'audit"
        description="Historique complet des actions utilisateurs"
      >
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchLogs(page, filters)}
          disabled={isPending}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isPending ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </PageHeader>

      <KpiGrid cols={3}>
        <KpiCard label="Événements affichés" value={logs.length} />
        <KpiCard label="Total filtrés" value={total} />
        <KpiCard label="Aujourd'hui" value={todayCount} variant="info" />
      </KpiGrid>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Filtrer par action…"
            value={filters.action}
            onChange={(e) => handleFilterChange("action", e.target.value)}
          />
        </div>
        <Select
          value={filters.entityType || "all"}
          onValueChange={(v) =>
            handleFilterChange("entityType", v === "all" ? "" : v)
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Type d'entité" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {entityTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Utilisateur</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entité</TableHead>
              <TableHead>ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground py-8"
                >
                  Aucun événement d'audit
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTime(log.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>
                      <p className="font-medium">
                        {log.user?.name ?? "Système"}
                      </p>
                      {log.user?.email && (
                        <p className="text-xs text-muted-foreground">
                          {log.user.email}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs font-mono ${getActionColor(log.action)}`}>
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{log.entityType}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {log.entityId.slice(0, 12)}…
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} sur {totalPages} ({total} événements)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1 || isPending}
              onClick={() => fetchLogs(page - 1, filters)}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isPending}
              onClick={() => fetchLogs(page + 1, filters)}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
