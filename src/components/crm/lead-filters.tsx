"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface LeadFiltersProps {
  teamMembers: { id: string; name: string | null; email: string }[];
}

const LEAD_STATUSES = [
  { value: "all", label: "Tous" },
  { value: "NEW", label: "Nouveau" },
  { value: "CONTACTED", label: "Contacté" },
  { value: "QUALIFIED", label: "Qualifié" },
  { value: "QUOTED", label: "Devis envoyé" },
  { value: "WON", label: "Gagné" },
  { value: "LOST", label: "Perdu" },
];

export function LeadFilters({ teamMembers }: LeadFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "all");
  const [assignee, setAssignee] = useState(searchParams.get("assignee") || "all");

  useEffect(() => {
    setSearch(searchParams.get("q") || "");
    setStatus(searchParams.get("status") || "all");
    setAssignee(searchParams.get("assignee") || "all");
  }, [searchParams]);

  const updateParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === "all") params.delete(key);
      else params.set(key, value);
    });
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
      <div className="w-full sm:w-64">
        <Input
          placeholder="Rechercher un lead..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") updateParams({ q: search });
          }}
        />
      </div>

      <Button
        size="sm"
        className="bg-accent text-accent-foreground hover:bg-accent/90"
        onClick={() => updateParams({ q: search })}
      >
        Rechercher
      </Button>

      <Select
        value={status}
        onValueChange={(v) => {
          setStatus(v);
          updateParams({ status: v });
        }}
      >
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="Statut" />
        </SelectTrigger>
        <SelectContent>
          {LEAD_STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={assignee}
        onValueChange={(v) => {
          setAssignee(v);
          updateParams({ assignee: v });
        }}
      >
        <SelectTrigger className="w-full sm:w-[200px]">
          <SelectValue placeholder="Assigné" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous</SelectItem>
          {teamMembers.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name || m.email}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      </div>
    </div>
  );
}
