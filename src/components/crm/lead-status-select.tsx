"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateLeadStatus } from "@/lib/actions/contact.actions";

const LEAD_STATUSES = [
  { value: "NEW", label: "Nouveau" },
  { value: "CONTACTED", label: "Contacté" },
  { value: "QUALIFIED", label: "Qualifié" },
  { value: "QUOTED", label: "Devis envoyé" },
  { value: "WON", label: "Gagné" },
  { value: "LOST", label: "Perdu" },
];

interface LeadStatusSelectProps {
  leadId: string;
  currentStatus: string;
}

export function LeadStatusSelect({ leadId, currentStatus }: LeadStatusSelectProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleChange = async (newStatus: string) => {
    if (newStatus === currentStatus) return;
    setLoading(true);
    try {
      const result = await updateLeadStatus(leadId, newStatus);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Statut mis à jour");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Select defaultValue={currentStatus} onValueChange={handleChange} disabled={loading}>
      <SelectTrigger className="w-full sm:w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LEAD_STATUSES.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
