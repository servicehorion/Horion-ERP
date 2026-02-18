"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addNegotiationLog } from "@/lib/actions/sourcing.actions";
import { Loader2, MessageSquarePlus } from "lucide-react";

export function NegotiationForm({ sourcingCaseId }: { sourcingCaseId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    const result = await addNegotiationLog({
      sourcingCaseId,
      message: fd.get("message") as string,
      direction: fd.get("direction") as string,
      channel: (fd.get("channel") as string) || undefined,
    });

    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }

    e.currentTarget.reset();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <MessageSquarePlus className="h-4 w-4" />
        Ajouter un échange
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-2 text-sm text-red-600">{error}</div>
      )}

      <Textarea name="message" placeholder="Contenu du message échangé..." rows={2} required />

      <div className="flex items-center gap-3">
        <Select name="direction" defaultValue="OUTBOUND">
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="OUTBOUND">Envoyé</SelectItem>
            <SelectItem value="INBOUND">Reçu</SelectItem>
          </SelectContent>
        </Select>

        <Select name="channel">
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Canal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="wechat">WeChat</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="phone">Téléphone</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="alibaba">Alibaba Chat</SelectItem>
          </SelectContent>
        </Select>

        <Button type="submit" size="sm" disabled={loading} className="ml-auto">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Ajouter
        </Button>
      </div>
    </form>
  );
}
