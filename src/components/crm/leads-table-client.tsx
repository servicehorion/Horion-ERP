"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  flexRender,
  RowSelectionState,
} from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal, Archive, Trash2, RotateCcw } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LeadAssigneeSelect } from "@/components/crm/lead-assignee-select";
import { formatDate } from "@/lib/utils";
import { formatCurrency } from "@/config/currencies";
import {
  archiveLead,
  restoreLead,
  deleteLead,
  bulkDeleteLeads,
  bulkArchiveLeads,
} from "@/lib/actions/contact.actions";
import { toast } from "sonner";

export type LeadRowWithAssignment = {
  id: string;
  description: string | null;
  contactName: string;
  contactId: string;
  status: string;
  estimatedValue: number | null;
  currency: string;
  source: string | null;
  category: string | null;
  assignedTo: string | null;
  isArchived: boolean;
  score: number;
  slaStatus: string | null;
  createdAt: Date;
};

const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: "Nouveau",
  CONTACTED: "Contacté",
  QUALIFIED: "Qualifié",
  QUOTED: "Devis envoyé",
  WON: "Gagné",
  LOST: "Perdu",
};

const LEAD_STATUS_COLORS: Record<string, string> = {
  NEW: "bg-gray-100 text-gray-800",
  CONTACTED: "bg-blue-100 text-blue-800",
  QUALIFIED: "bg-indigo-100 text-indigo-800",
  QUOTED: "bg-yellow-100 text-yellow-800",
  WON: "bg-green-100 text-green-800",
  LOST: "bg-red-100 text-red-800",
};

interface LeadsTableClientProps {
  leads: LeadRowWithAssignment[];
  teamMembers: { id: string; name: string | null; email: string }[];
  showArchived?: boolean;
}

export function LeadsTableClient({ leads, teamMembers, showArchived = false }: LeadsTableClientProps) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isPending, startTransition] = useTransition();

  const selectedIds = Object.keys(rowSelection)
    .map((idx) => leads[Number(idx)]?.id)
    .filter(Boolean) as string[];

  function handleBulkArchive() {
    if (!selectedIds.length) return;
    if (!confirm(`Archiver ${selectedIds.length} lead(s) ?`)) return;
    startTransition(async () => {
      const res = await bulkArchiveLeads(selectedIds);
      if (res.error) { toast.error(res.error); return; }
      toast.success(`${res.archived} lead(s) archivé(s)`);
      setRowSelection({});
      router.refresh();
    });
  }

  function handleBulkDelete() {
    if (!selectedIds.length) return;
    if (!confirm(`Supprimer définitivement ${selectedIds.length} lead(s) ? Cette action est irréversible.`)) return;
    startTransition(async () => {
      const res = await bulkDeleteLeads(selectedIds);
      if (res.error) { toast.error(res.error); return; }
      toast.success(`${res.deleted} lead(s) supprimé(s)`);
      setRowSelection({});
      router.refresh();
    });
  }

  function handleArchive(leadId: string) {
    startTransition(async () => {
      const res = await archiveLead(leadId);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Lead archivé");
      router.refresh();
    });
  }

  function handleRestore(leadId: string) {
    startTransition(async () => {
      const res = await restoreLead(leadId);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Lead restauré");
      router.refresh();
    });
  }

  function handleDelete(leadId: string) {
    if (!confirm("Supprimer définitivement ce lead ? Cette action est irréversible.")) return;
    startTransition(async () => {
      const res = await deleteLead(leadId);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Lead supprimé");
      router.refresh();
    });
  }

  const columns: ColumnDef<LeadRowWithAssignment>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Tout sélectionner"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Sélectionner"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      size: 40,
    },
    {
      accessorKey: "description",
      header: "Lead",
      cell: ({ row }) => {
        const lead = row.original;
        return (
          <div className="space-y-1">
            <Link href={`/crm/leads/${lead.id}`} className="font-medium text-primary hover:underline">
              {lead.description || lead.source || "Sans description"}
            </Link>
            <div className="text-xs text-muted-foreground">{lead.contactName}</div>
            <div className="flex flex-wrap gap-1">
              {lead.category && (
                <Badge variant="outline" className="text-xs">{lead.category}</Badge>
              )}
              {lead.isArchived && (
                <Badge className="bg-orange-100 text-orange-800 text-xs">Archivé</Badge>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Statut",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <Badge className={LEAD_STATUS_COLORS[status] || ""}>
            {LEAD_STATUS_LABELS[status] || status}
          </Badge>
        );
      },
    },
    {
      accessorKey: "estimatedValue",
      header: "Valeur",
      cell: ({ row }) => {
        const value = row.original.estimatedValue;
        if (!value || value <= 0) return "—";
        return formatCurrency(value, row.original.currency);
      },
    },
    {
      accessorKey: "score",
      header: "Score",
      cell: ({ row }) => {
        const score = row.original.score ?? 0;
        const color =
          score >= 70
            ? "bg-green-100 text-green-800"
            : score >= 40
            ? "bg-amber-100 text-amber-800"
            : "bg-red-100 text-red-800";
        return (
          <Badge className={`${color} text-xs`}>{score}%</Badge>
        );
      },
    },
    {
      accessorKey: "slaStatus",
      header: "SLA",
      cell: ({ row }) => {
        const sla = row.original.slaStatus;
        if (!sla) return <span className="text-muted-foreground text-xs">—</span>;
        const config: Record<string, string> = {
          OK: "bg-green-100 text-green-800",
          WARNING: "bg-orange-100 text-orange-800",
          BREACH: "bg-red-100 text-red-800",
        };
        const labels: Record<string, string> = {
          OK: "OK",
          WARNING: "Critique",
          BREACH: "Dépassé",
        };
        return <Badge className={`${config[sla] ?? "bg-slate-100"} text-xs`}>{labels[sla] ?? sla}</Badge>;
      },
    },
    {
      id: "assignedTo",
      header: "Assigné",
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <LeadAssigneeSelect
            leadId={row.original.id}
            currentAssignee={row.original.assignedTo}
            teamMembers={teamMembers}
          />
        </div>
      ),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Créé le <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => formatDate(row.getValue("createdAt")),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const lead = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href={`/crm/leads/${lead.id}`}>Voir</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/crm/leads/${lead.id}/edit`}>Modifier</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/orders/new?contactId=${lead.contactId}`}>Créer commande</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/contacts/${lead.contactId}`}>Voir contact</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {lead.isArchived ? (
                <DropdownMenuItem onClick={() => handleRestore(lead.id)}>
                  <RotateCcw className="mr-2 h-3.5 w-3.5" />
                  Restaurer
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => handleArchive(lead.id)}>
                  <Archive className="mr-2 h-3.5 w-3.5" />
                  Archiver
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => handleDelete(lead.id)}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data: leads,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    state: { sorting, rowSelection },
  });

  return (
    <div className="space-y-3">
      {/* Bulk action toolbar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2">
          <Badge variant="secondary">{selectedIds.length} sélectionné(s)</Badge>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={handleBulkArchive}
            disabled={isPending || showArchived}
          >
            <Archive className="h-3.5 w-3.5" />
            Archiver
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="gap-1.5"
            onClick={handleBulkDelete}
            disabled={isPending}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Supprimer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setRowSelection({})}>
            Annuler
          </Button>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} style={{ width: h.column.getSize() !== 150 ? h.column.getSize() : undefined }}>
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  Aucun lead
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
