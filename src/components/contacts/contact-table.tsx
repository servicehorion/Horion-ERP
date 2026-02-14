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

export type ContactTableRow = {
  id: string;
  name: string;
  type: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  trustScore: number;
  ordersCount: number;
  leadsCount: number;
  createdAt: Date;
};

const TYPE_LABELS: Record<string, string> = {
  CLIENT: "Client",
  PROSPECT: "Prospect",
  SUPPLIER: "Fournisseur",
  FREIGHT_PARTNER: "Transitaire",
  CUSTOMS_BROKER: "Douanier",
  QC_PARTNER: "QC",
  OTHER: "Autre",
};

const TYPE_COLORS: Record<string, string> = {
  CLIENT: "bg-green-100 text-green-800",
  PROSPECT: "bg-blue-100 text-blue-800",
  SUPPLIER: "bg-orange-100 text-orange-800",
  FREIGHT_PARTNER: "bg-cyan-100 text-cyan-800",
  CUSTOMS_BROKER: "bg-purple-100 text-purple-800",
  QC_PARTNER: "bg-pink-100 text-pink-800",
  OTHER: "bg-gray-100 text-gray-800",
};

export const contactColumns: ColumnDef<ContactTableRow>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Nom
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <Link href={`/contacts/${row.original.id}`} className="font-medium text-primary hover:underline">
        {row.getValue("name")}
      </Link>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => {
      const type = row.getValue("type") as string;
      return (
        <Badge variant="secondary" className={TYPE_COLORS[type] || ""}>
          {TYPE_LABELS[type] || type}
        </Badge>
      );
    },
  },
  {
    accessorKey: "company",
    header: "Entreprise",
    cell: ({ row }) => row.getValue("company") || "-",
  },
  {
    accessorKey: "phone",
    header: "Téléphone",
    cell: ({ row }) => row.getValue("phone") || "-",
  },
  {
    accessorKey: "trustScore",
    header: "Score",
    cell: ({ row }) => {
      const score = row.getValue("trustScore") as number;
      return (
        <div className="flex items-center gap-2">
          <div className="h-2 w-16 rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary"
              style={{ width: `${score}%` }}
            />
          </div>
          <span className="text-sm text-muted-foreground">{score}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "ordersCount",
    header: "Commandes",
    cell: ({ row }) => row.getValue("ordersCount") as number,
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Créé le
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => formatDate(row.getValue("createdAt")),
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const contact = row.original;
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
              <Link href={`/contacts/${contact.id}`}>Voir fiche</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/orders/new?contactId=${contact.id}`}>Nouvelle commande</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
