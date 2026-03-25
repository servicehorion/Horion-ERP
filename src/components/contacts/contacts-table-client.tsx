"use client";

import {
  ColumnDef,
  ColumnFiltersState,
  RowSelectionState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ChevronDown,
  Copy,
  GitMerge,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { deleteContacts, updateContact } from "@/lib/actions/contact.actions";
import { WhatsAppTemplateDialog } from "@/components/contacts/whatsapp-template-dialog";
import { MergeContactsDialog } from "@/components/contacts/merge-contacts-dialog";

export type ContactRow = {
  id: string;
  name: string;
  type: string;
  company: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  city: string | null;
  trustScore: number;
  ordersCount: number;
  leadsCount: number;
  tags: string[];
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

function TagsCell({ contact }: { contact: ContactRow }) {
  const router = useRouter();
  const [tags, setTags] = useState<string[]>(contact.tags);
  const [newTag, setNewTag] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const removeTag = async (tag: string) => {
    const next = tags.filter((t) => t !== tag);
    setTags(next);
    await updateContact(contact.id, { tags: next });
    router.refresh();
  };

  const addTag = async () => {
    const trimmed = newTag.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    const next = [...tags, trimmed];
    setTags(next);
    setNewTag("");
    setOpen(false);
    await updateContact(contact.id, { tags: next });
    router.refresh();
  };

  return (
    <div className="flex flex-wrap gap-1 max-w-[200px]">
      {tags.map((tag) => (
        <Badge
          key={tag}
          variant="secondary"
          className="text-xs gap-1 pr-1"
        >
          {tag}
          <button
            onClick={() => removeTag(tag)}
            className="ml-0.5 hover:text-destructive"
            aria-label={`Supprimer ${tag}`}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </Badge>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="inline-flex items-center justify-center h-5 w-5 rounded-full border border-dashed text-muted-foreground hover:border-foreground hover:text-foreground">
            <Plus className="h-2.5 w-2.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="flex gap-1">
            <Input
              ref={inputRef}
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
              placeholder="Nouveau tag..."
              className="h-7 text-xs"
              autoFocus
            />
            <Button size="sm" className="h-7 px-2" onClick={addTag}>
              OK
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function PhoneCell({ contact }: { contact: ContactRow }) {
  const phone = contact.phone;
  const wa = contact.whatsapp || contact.phone;

  const copyPhone = () => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    toast.success("Numéro copié !");
  };

  const openWA = () => {
    if (!wa) return;
    const num = wa.replace(/[^\d+]/g, "");
    window.open(`https://wa.me/${num}`, "_blank");
  };

  if (!phone && !wa) return <span className="text-muted-foreground">—</span>;

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="truncate text-sm">{phone || "—"}</span>
      {phone && (
        <button
          onClick={copyPhone}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          title="Copier le numéro"
        >
          <Copy className="h-3 w-3" />
        </button>
      )}
      {(contact.whatsapp || contact.phone) && (
        <button
          onClick={openWA}
          className="shrink-0"
          title="Ouvrir WhatsApp"
        >
          <Badge className="bg-green-100 text-green-700 hover:bg-green-200 text-[10px] px-1 py-0 h-4 cursor-pointer">
            WA
          </Badge>
        </button>
      )}
    </div>
  );
}

function ActionsCell({ contact }: { contact: ContactRow }) {
  const [waOpen, setWaOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);

  return (
    <>
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
            <Link href={`/contacts/${contact.id}/edit`}>Modifier</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/orders/new?contactId=${contact.id}`}>Nouvelle commande</Link>
          </DropdownMenuItem>
          {contact.type === "PROSPECT" && (
            <DropdownMenuItem asChild>
              <Link href={`/crm/leads/new?contactId=${contact.id}`}>Créer un lead</Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setMergeOpen(true); }}>
            <GitMerge className="mr-2 h-4 w-4 text-primary" />
            Fusionner (doublon)
          </DropdownMenuItem>
          {(contact.whatsapp || contact.phone) && (
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setWaOpen(true); }}>
              <MessageCircle className="mr-2 h-4 w-4 text-green-600" />
              Envoyer WhatsApp (template)
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <MergeContactsDialog
        contactId={contact.id}
        contactName={contact.name}
        contactPhone={contact.phone}
        contactEmail={contact.email}
        open={mergeOpen}
        onOpenChange={setMergeOpen}
      />

      {(contact.whatsapp || contact.phone) && (
        <WhatsAppTemplateDialog
          contact={contact}
          open={waOpen}
          onOpenChange={setWaOpen}
        />
      )}
    </>
  );
}

const columns: ColumnDef<ContactRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Tout sélectionner"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Sélectionner la ligne"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Nom <ArrowUpDown className="ml-2 h-4 w-4" />
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
    cell: ({ row }) => row.getValue("company") || "—",
  },
  {
    id: "phone",
    accessorKey: "phone",
    header: "Téléphone",
    cell: ({ row }) => <PhoneCell contact={row.original} />,
  },
  {
    id: "tags",
    accessorKey: "tags",
    header: "Tags",
    cell: ({ row }) => <TagsCell contact={row.original} />,
    enableSorting: false,
  },
  {
    accessorKey: "trustScore",
    header: "Score",
    cell: ({ row }) => {
      const score = row.getValue("trustScore") as number;
      return (
        <div className="flex items-center gap-2">
          <div className="h-2 w-16 rounded-full bg-muted">
            <div className="h-2 rounded-full bg-primary" style={{ width: `${score}%` }} />
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
        Créé le <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => formatDate(row.getValue("createdAt")),
  },
  {
    id: "actions",
    cell: ({ row }) => <ActionsCell contact={row.original} />,
    enableHiding: false,
  },
];

interface ContactsTableClientProps {
  data: ContactRow[];
}

export function ContactsTableClient({ data }: ContactsTableClientProps) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [deleting, setDeleting] = useState(false);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    state: { sorting, columnFilters, columnVisibility, rowSelection },
  });

  const selectedIds = table
    .getFilteredSelectedRowModel()
    .rows.map((r) => r.original.id);

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    const confirmed = window.confirm(
      `Supprimer ${selectedIds.length} contact(s) ? Cette action est irréversible.`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const result = await deleteContacts(selectedIds);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${result.data?.deleted ?? selectedIds.length} contact(s) supprimé(s)`);
        setRowSelection({});
        router.refresh();
      }
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search + column picker */}
      <div className="flex items-center justify-between gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un contact..."
            value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
            onChange={(e) => table.getColumn("name")?.setFilterValue(e.target.value)}
            className="pl-9"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              Colonnes <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((col) => col.getCanHide())
              .map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={col.getIsVisible()}
                  onCheckedChange={(v) => col.toggleVisibility(!!v)}
                  className="capitalize"
                >
                  {col.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Bulk action toolbar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2">
          <Badge variant="destructive" className="text-sm">
            {selectedIds.length} sélectionné(s)
          </Badge>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleBulkDelete}
            disabled={deleting}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? "Suppression..." : "Supprimer"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRowSelection({})}
          >
            Annuler
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
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
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Aucun résultat.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end space-x-2">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} sur{" "}
          {table.getFilteredRowModel().rows.length} ligne(s)
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Précédent
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Suivant
          </Button>
        </div>
      </div>
    </div>
  );
}
