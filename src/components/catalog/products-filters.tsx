"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

interface Category {
  id: string;
  name: string;
}

interface Props {
  categories: Category[];
  currentStatus?: string;
  currentCategory?: string;
  currentSearch?: string;
}

export function ProductsFilters({ categories, currentStatus, currentCategory, currentSearch }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const updateFilter = useCallback(
    (updates: Record<string, string | undefined>) => {
      const current = new URLSearchParams();
      if (currentStatus && currentStatus !== "all") current.set("status", currentStatus);
      if (currentCategory) current.set("category", currentCategory);
      if (currentSearch) current.set("q", currentSearch);

      for (const [k, v] of Object.entries(updates)) {
        if (v && v !== "all" && v !== "") current.set(k, v);
        else current.delete(k);
      }
      current.delete("page"); // reset pagination on filter change
      router.push(`${pathname}?${current.toString()}`);
    },
    [router, pathname, currentStatus, currentCategory, currentSearch]
  );

  const hasActiveFilters = currentStatus || currentCategory || currentSearch;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-48 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          key={currentSearch}
          defaultValue={currentSearch || ""}
          placeholder="Rechercher un produit…"
          className="pl-9"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              updateFilter({ q: (e.target as HTMLInputElement).value });
            }
          }}
          onBlur={(e) => {
            if (e.target.value !== (currentSearch || "")) {
              updateFilter({ q: e.target.value });
            }
          }}
        />
      </div>

      {/* Status filter */}
      <Select
        value={currentStatus || "all"}
        onValueChange={(v) => updateFilter({ status: v === "all" ? undefined : v })}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Statut" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les statuts</SelectItem>
          <SelectItem value="TESTING">En test</SelectItem>
          <SelectItem value="TESTED">Testé</SelectItem>
          <SelectItem value="CURATED">Curé</SelectItem>
          <SelectItem value="BLACKLIST">Blacklisté</SelectItem>
        </SelectContent>
      </Select>

      {/* Category filter */}
      {categories.length > 0 && (
        <Select
          value={currentCategory || "all"}
          onValueChange={(v) => updateFilter({ category: v === "all" ? undefined : v })}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Clear filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(pathname)}
          className="text-muted-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          Effacer
        </Button>
      )}
    </div>
  );
}
