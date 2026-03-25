"use client";

import { useEffect, useMemo, useState } from "react";
import { Filter, Plus, Star, Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  getSavedFilters,
  createSavedFilter,
  deleteSavedFilter,
} from "@/lib/actions/task.actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface SavedFilter {
  id: string;
  name: string;
  filters: Record<string, any>;
  isShared: boolean;
  isDefault: boolean;
}

interface TaskSavedFiltersProps {
  entityType: string;
  currentFilters: Record<string, string | undefined>;
}

export function TaskSavedFilters({ entityType, currentFilters }: TaskSavedFiltersProps) {
  const [filters, setFilters] = useState<SavedFilter[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [name, setName] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const cleanFilters = useMemo(() => {
    const cleaned: Record<string, string> = {};
    Object.entries(currentFilters).forEach(([k, v]) => {
      if (v && v !== "all" && v !== "") cleaned[k] = v;
    });
    return cleaned;
  }, [currentFilters]);

  useEffect(() => {
    let active = true;
    getSavedFilters(entityType).then((res) => {
      if (!active) return;
      if (res?.data) setFilters(res.data as SavedFilter[]);
    });
    return () => {
      active = false;
    };
  }, [entityType]);

  const applyFilter = (filter: SavedFilter) => {
    const params = new URLSearchParams();
    Object.entries(filter.filters || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "" && v !== "all") {
        params.set(k, String(v));
      }
    });
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    const res = await createSavedFilter({
      name: name.trim(),
      entityType,
      filters: cleanFilters,
      isShared,
      isDefault,
    });
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Vue sauvegardee");
    setFilters((prev) => [res.data as SavedFilter, ...prev]);
    setName("");
    setIsShared(false);
    setIsDefault(false);
    setOpenDialog(false);
  };

  const handleDelete = async (id: string) => {
    const res = await deleteSavedFilter(id);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    setFilters((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs">
            <Filter className="h-3.5 w-3.5 mr-1" />
            Vues
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Vues sauvegardees</DropdownMenuLabel>
          {filters.length === 0 && (
            <div className="px-2 py-3 text-xs text-muted-foreground">Aucune vue</div>
          )}
          {filters.map((filter) => (
            <DropdownMenuItem key={filter.id} onSelect={() => applyFilter(filter)} className="flex items-center gap-2">
              {filter.isDefault && <Star className="h-3.5 w-3.5 text-yellow-500" />}
              <span className="flex-1 truncate">{filter.name}</span>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDelete(filter.id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setOpenDialog(true)}>
            <Plus className="h-3.5 w-3.5 mr-2" />
            Sauvegarder la vue
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogTrigger asChild>
          <span />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sauvegarder la vue courante</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nom de la vue" value={name} onChange={(e) => setName(e.target.value)} />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isShared} onCheckedChange={(v) => setIsShared(Boolean(v))} />
              Partager avec l'equipe
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isDefault} onCheckedChange={(v) => setIsDefault(Boolean(v))} />
              Definir comme vue par defaut
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>Annuler</Button>
            <Button onClick={handleSave}>Sauvegarder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
