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
import { updatePipelineIntentStatus } from "@/lib/actions/customer-intelligence.actions";

interface PipelineIntentStatusSelectProps {
  intentId: string;
  currentStatus: string;
  demoMode?: boolean;
}

export function PipelineIntentStatusSelect({
  intentId,
  currentStatus,
  demoMode,
}: PipelineIntentStatusSelectProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleChange = async (newStatus: string) => {
    if (newStatus === currentStatus) return;
    if (demoMode) return;
    setLoading(true);
    try {
      const result = await updatePipelineIntentStatus(intentId, newStatus);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Statut mis Ã  jour");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Select
      defaultValue={currentStatus}
      onValueChange={handleChange}
      disabled={loading || demoMode}
    >
      <SelectTrigger className="h-7 w-[140px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="active">Active</SelectItem>
        <SelectItem value="converted">Convertie</SelectItem>
        <SelectItem value="lost">Perdue</SelectItem>
      </SelectContent>
    </Select>
  );
}
