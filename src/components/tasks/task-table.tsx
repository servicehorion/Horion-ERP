"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Clock, MoreHorizontal } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { TaskStatusBadge, PriorityBadge } from "@/components/shared/status-badge";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type TaskTableRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  module: string;
  entityType: string;
  entityId: string;
  slaDeadline: Date | null;
  assignedTo: { name: string } | null;
  slaBreach: boolean;
};

export const taskColumns: ColumnDef<TaskTableRow>[] = [
  {
    accessorKey: "title",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Titre
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const task = row.original;
      return (
        <div className="flex items-center gap-2">
          {task.slaBreach && (
            <Clock className="h-4 w-4 text-destructive" />
          )}
          <span className="font-medium">{row.getValue("title")}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "module",
    header: "Module",
    cell: ({ row }) => {
      const module = row.getValue("module") as string;
      return <Badge variant="outline">{module}</Badge>;
    },
  },
  {
    accessorKey: "entityType",
    header: "Type",
    cell: ({ row }) => {
      const task = row.original;
      return (
        <div className="text-sm">
          <div className="text-muted-foreground">{task.entityType}</div>
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Statut",
    cell: ({ row }) => {
      return <TaskStatusBadge status={row.getValue("status")} />;
    },
  },
  {
    accessorKey: "priority",
    header: "Priorité",
    cell: ({ row }) => {
      return <PriorityBadge priority={row.getValue("priority")} />;
    },
  },
  {
    accessorKey: "assignedTo",
    header: "Assignée à",
    cell: ({ row }) => {
      const assignedTo = row.original.assignedTo;
      return (
        <span className="text-sm">
          {assignedTo?.name || (
            <span className="text-muted-foreground">Non assignée</span>
          )}
        </span>
      );
    },
  },
  {
    accessorKey: "slaDeadline",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Échéance
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const slaDeadline = row.getValue("slaDeadline") as Date | null;
      const slaBreach = row.original.slaBreach;

      if (!slaDeadline) {
        return <span className="text-muted-foreground">-</span>;
      }

      return (
        <span
          className={cn(
            "text-sm",
            slaBreach && "font-medium text-destructive"
          )}
        >
          {formatDate(slaDeadline, true)}
        </span>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const task = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Ouvrir menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(task.id)}
            >
              Copier ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              {task.entityType === "Order" ? (
                <Link href={`/orders/${task.entityId}`}>Voir la commande</Link>
              ) : (
                <span>{"Voir l'entité"}</span>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
