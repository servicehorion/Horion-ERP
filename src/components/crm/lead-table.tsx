"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { formatCurrency } from "@/config/currencies";

export type LeadTableRow = {
  id: string;
  description: string | null;
  contactName: string;
  contactId: string;
  status: string;
  estimatedValue: number | null;
  currency: string;
  source: string | null;
  category: string | null;
  assigneeName?: string | null;
  createdAt: Date;
};

const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: "Nouveau",
  CONTACTED: "ContactÃ©",
  QUALIFIED: "QualifiÃ©",
  QUOTED: "Devis envoyÃ©",
  WON: "GagnÃ©",
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

export const leadColumns: ColumnDef<LeadTableRow>[] = [
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
          <div className="text-xs text-muted-foreground">
            {lead.contactName}
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
      if (!value || value <= 0) return "â€”";
      return formatCurrency(value, row.original.currency);
    },
  },
  {
    accessorKey: "assigneeName",
    header: "AssignÃ©",
    cell: ({ row }) => row.original.assigneeName || "â€”",
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        CrÃ©Ã© le
        <ArrowUpDown className="ml-2 h-4 w-4" />
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
              <Link href={`/orders/new?contactId=${lead.contactId}`}>CrÃ©er commande</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/contacts/${lead.contactId}`}>Voir contact</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
