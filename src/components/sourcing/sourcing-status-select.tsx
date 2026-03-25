"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateSourcingStatus } from "@/lib/actions/sourcing.actions";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "SEARCHING", label: "Recherche" },
  { value: "OFFERS_RECEIVED", label: "Offres reçues" },
  { value: "NEGOTIATING", label: "Négociation" },
  { value: "SELECTED", label: "Sélectionné" },
  { value: "CONFIRMED", label: "Confirmé" },
  { value: "CANCELLED", label: "Annulé" },
];

export function SourcingStatusSelect({
  caseId,
  currentStatus,
}: {
  caseId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleChange(value: string) {
    if (value === currentStatus) return;
    setLoading(true);
    const result = await updateSourcingStatus(caseId, { status: value });
    setLoading(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Statut sourcing mis a jour");
    router.refresh();
  }

  return (
    <Select value={currentStatus} onValueChange={handleChange} disabled={loading}>
      <SelectTrigger className="w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
