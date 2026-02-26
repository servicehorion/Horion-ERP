"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { approveTimeEntry, deleteTimeEntry } from "@/lib/actions/project.actions";
import { cn } from "@/lib/utils";

interface TimeEntry {
  id: string;
  minutes: number;
  description?: string | null;
  startedAt: string | Date;
  billable: boolean;
  approved: boolean;
  cost?: number | null;
  user: { id: string; name: string };
}

interface TaskTimeEntriesPanelProps {
  entries: TimeEntry[];
  currentUserId: string;
  canApprove?: boolean; // ADMIN/MANAGER only
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

export function TaskTimeEntriesPanel({
  entries,
  currentUserId,
  canApprove = false,
}: TaskTimeEntriesPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const totalMinutes = entries.reduce((s, e) => s + e.minutes, 0);
  const totalCost = entries.reduce((s, e) => s + Number(e.cost ?? 0), 0);

  const handleApprove = (entryId: string) => {
    startTransition(async () => {
      const res = await approveTimeEntry(entryId);
      if (res.error) toast.error(res.error);
      else { toast.success("Entrée approuvée"); router.refresh(); }
    });
  };

  const handleDelete = (entryId: string) => {
    startTransition(async () => {
      const res = await deleteTimeEntry(entryId);
      if (res.error) toast.error(res.error);
      else { toast.success("Entrée supprimée"); router.refresh(); }
    });
  };

  if (entries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-3">
        Aucune entrée de temps enregistrée
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {/* Summary */}
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-medium text-muted-foreground">
          Total : {formatDuration(totalMinutes)}
        </span>
        {totalCost > 0 && (
          <span className="text-muted-foreground">
            {totalCost.toLocaleString("fr-FR")} XAF
          </span>
        )}
      </div>

      {/* Entry list */}
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center gap-2 p-2 rounded-md border text-xs group"
          >
            <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-medium">{formatDuration(entry.minutes)}</span>
                <span className="text-muted-foreground truncate">— {entry.user.name}</span>
                {entry.billable && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">
                    Facturable
                  </Badge>
                )}
              </div>
              {entry.description && (
                <p className="text-muted-foreground truncate mt-0.5">{entry.description}</p>
              )}
              <p className="text-muted-foreground mt-0.5">
                {new Date(entry.startedAt).toLocaleDateString("fr-FR", {
                  day: "numeric", month: "short", year: "numeric",
                })}
                {entry.cost ? ` · ${Number(entry.cost).toLocaleString("fr-FR")} XAF` : ""}
              </p>
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {!entry.approved && canApprove && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-green-600"
                  onClick={() => handleApprove(entry.id)}
                  disabled={isPending}
                  title="Approuver"
                >
                  <Check className="h-3 w-3" />
                </Button>
              )}
              {(entry.user.id === currentUserId || canApprove) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-red-500"
                  onClick={() => handleDelete(entry.id)}
                  disabled={isPending}
                  title="Supprimer"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>

            {entry.approved && (
              <Check className="h-3 w-3 text-green-600 flex-shrink-0" title="Approuvé" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
