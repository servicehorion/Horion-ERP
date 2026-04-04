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
import { updateLead } from "@/lib/actions/contact.actions";

interface LeadAssigneeSelectProps {
  leadId: string;
  currentAssignee?: string | null;
  teamMembers: { id: string; name: string | null; email: string }[];
}

export function LeadAssigneeSelect({
  leadId,
  currentAssignee,
  teamMembers,
}: LeadAssigneeSelectProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleChange = async (newAssignee: string) => {
    if (newAssignee === (currentAssignee || "")) return;
    setLoading(true);
    try {
      const result = await updateLead(leadId, {
        assignedTo: newAssignee === "none" ? null : newAssignee,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Assignation mise à jour");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Select
      defaultValue={currentAssignee || "none"}
      onValueChange={handleChange}
      disabled={loading}
    >
      <SelectTrigger className="w-full sm:w-[200px]">
        <SelectValue placeholder="Assigner" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Non assigné</SelectItem>
        {teamMembers.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.name || m.email}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
