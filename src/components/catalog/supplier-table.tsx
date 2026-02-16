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

export type SupplierTableRow = {
  id: string;
  name: string;
  city: string | null;
  platform: string | null;
  status: string;
  rating: number;
  productsCount: number;
  offersCount: number;
  createdAt: Date;
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  TESTING: "bg-yellow-100 text-yellow-800",
  SUSPENDED: "bg-orange-100 text-orange-800",
  BLACKLIST: "bg-red-100 text-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actif",
  TESTING: "En test",
  SUSPENDED: "Suspendu",
  BLACKLIST: "Blacklisté",
};

const PLATFORM_COLORS: Record<string, string> = {
  "1688": "bg-orange-100 text-orange-800",
  Alibaba: "bg-amber-100 text-amber-800",
  Offline: "bg-gray-100 text-gray-800",
  Autre: "bg-slate-100 text-slate-800",
};

export const supplierColumns: ColumnDef<SupplierTableRow>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Nom
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <Link
        href={`/catalog/suppliers/${row.original.id}`}
        className="font-medium text-primary hover:underline"
      >
        {row.getValue("name")}
      </Link>
    ),
  },
  {
    accessorKey: "city",
    header: "Ville",
    cell: ({ row }) => row.getValue("city") || "-",
  },
  {
    accessorKey: "platform",
    header: "Plateforme",
    cell: ({ row }) => {
      const platform = row.getValue("platform") as string | null;
      if (!platform) return "-";
      return (
        <Badge variant="secondary" className={PLATFORM_COLORS[platform] || ""}>
          {platform}
        </Badge>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Statut",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <Badge variant="secondary" className={STATUS_COLORS[status] || ""}>
          {STATUS_LABELS[status] || status}
        </Badge>
      );
    },
  },
  {
    accessorKey: "rating",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Score
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const rating = row.getValue("rating") as number;
      return (
        <div className="flex items-center gap-2">
          <div className="h-2 w-16 rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary"
              style={{ width: `${rating}%` }}
            />
          </div>
          <span className="text-sm text-muted-foreground">{rating}/100</span>
        </div>
      );
    },
  },
  {
    accessorKey: "productsCount",
    header: "Produits",
    cell: ({ row }) => row.getValue("productsCount") as number,
  },
  {
    accessorKey: "offersCount",
    header: "Offres",
    cell: ({ row }) => row.getValue("offersCount") as number,
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const supplier = row.original;
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
              <Link href={`/catalog/suppliers/${supplier.id}`}>
                Voir fiche
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
