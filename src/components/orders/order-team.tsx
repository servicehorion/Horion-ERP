"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { updateOrderTeam } from "@/lib/actions/order.actions";

type TeamMember = { id: string; name: string | null; email: string; role: string };

interface OrderTeamProps {
  orderId: string;
  ownerId?: string | null;
  onboardedBy?: { name?: string | null; email?: string | null } | null;
  collaborators: { userId: string; user: { name: string | null; email: string } }[];
  teamMembers: TeamMember[];
  canEdit?: boolean;
}

export function OrderTeam({ orderId, ownerId, onboardedBy, collaborators, teamMembers, canEdit }: OrderTeamProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const initialCollaborators = useMemo(() => collaborators.map((c) => c.userId), [collaborators]);
  const [owner, setOwner] = useState(ownerId ?? "none");
  const [selected, setSelected] = useState<string[]>(initialCollaborators);

  const hasChanges = useMemo(() => {
    const initialSorted = [...initialCollaborators].sort().join(",");
    const selectedSorted = [...selected].sort().join(",");
    return (ownerId ?? "none") !== owner || initialSorted !== selectedSorted;
  }, [owner, ownerId, initialCollaborators, selected]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await updateOrderTeam(orderId, {
        ownerId: owner === "none" ? null : owner,
        collaboratorIds: selected,
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Equipe mise a jour");
        router.refresh();
      }
    } catch {
      toast.error("Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Responsables</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-medium">Owner principal</p>
              <p className="text-xs text-muted-foreground">Responsable commercial de la commande</p>
            </div>
            {canEdit ? (
              <Select value={owner} onValueChange={setOwner}>
                <SelectTrigger className="w-[260px]">
                  <SelectValue placeholder="Non assigne" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Non assigne</SelectItem>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name || m.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm">
                {teamMembers.find((m) => m.id === ownerId)?.name || "Non assigne"}
              </p>
            )}
          </div>

          <div>
            <p className="text-sm font-medium">Onboarde par</p>
            <p className="text-sm text-muted-foreground">
              {onboardedBy?.name || onboardedBy?.email || "-"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Collaborateurs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {teamMembers.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun collaborateur disponible</p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {teamMembers.map((m) => {
              const checked = selected.includes(m.id);
              return (
                <label key={m.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={checked}
                    disabled={!canEdit}
                    onCheckedChange={(value) => {
                      const next = new Set(selected);
                      if (value) next.add(m.id);
                      else next.delete(m.id);
                      setSelected(Array.from(next));
                    }}
                  />
                  <span>{m.name || m.email}</span>
                </label>
              );
            })}
          </div>

          {canEdit && (
            <div className="flex justify-end pt-2">
              <Button size="sm" disabled={!hasChanges || saving} onClick={handleSave}>
                Enregistrer
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
