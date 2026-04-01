"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  inviteTeamMember,
  updateMemberRole,
  deactivateMember,
  checkTeamMemberEmailAvailability,
} from "@/lib/actions/team.actions";
import type { UserRole } from "@prisma/client";

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: string | Date | null;
  createdAt: string | Date;
};

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "ADMIN", label: "Admin" },
  { value: "CEO", label: "CEO" },
  { value: "DIRECTION", label: "Direction" },
  { value: "CTO", label: "CTO" },
  { value: "AI_ENGINEER", label: "AI Engineer" },
  { value: "CRM_MANAGER", label: "CRM Manager" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "COMMUNITY_MANAGER", label: "Community Manager" },
  { value: "LOGISTICS_MANAGER", label: "Logistics Manager" },
  { value: "LOGISTICS_ASSISTANT", label: "Logistics Assistant" },
  { value: "SOURCING_ASSISTANT", label: "Sourcing Assistant" },
  { value: "FINANCE_MANAGER", label: "Finance Manager" },
  { value: "FINANCE", label: "Finance" },
  { value: "OPS", label: "Ops" },
];

const ROLE_LABELS = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label]));

function formatDate(value?: string | Date | null) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR");
}

export function TeamManager({ members }: { members: TeamMember[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "checking" | "ok" | "taken">("idle");
  const [emailStatusMessage, setEmailStatusMessage] = useState("");

  const [inviteForm, setInviteForm] = useState({
    email: "",
    name: "",
    role: "OPS" as UserRole,
  });

  const activeCount = useMemo(() => members.filter((m) => m.isActive).length, [members]);

  const handleInvite = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteError("");

    const res = await inviteTeamMember({
      email: inviteForm.email,
      name: inviteForm.name,
      role: inviteForm.role,
    });

    setInviteLoading(false);
    if (res?.error) {
      setInviteError(res.error);
      return;
    }

    toast.success("Invitation envoyee");
    setInviteOpen(false);
    setInviteForm({ email: "", name: "", role: "OPS" as UserRole });
    setEmailStatus("idle");
    setEmailStatusMessage("");
    router.refresh();
  };

  const handleEmailBlur = async () => {
    const email = inviteForm.email.trim();
    if (!email) return;

    setEmailStatus("checking");
    setEmailStatusMessage("Verification...");

    const res = await checkTeamMemberEmailAvailability(email);
    if (res.available) {
      setEmailStatus("ok");
      setEmailStatusMessage("Email disponible");
      return;
    }

    setEmailStatus("taken");
    setEmailStatusMessage(res.error || "Email non disponible");
  };

  const handleRoleChange = (memberId: string, role: UserRole) => {
    startTransition(async () => {
      const res = await updateMemberRole(memberId, role);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Role mis a jour");
      router.refresh();
    });
  };

  const handleToggleActive = (memberId: string, isActive: boolean) => {
    startTransition(async () => {
      const res = await deactivateMember(memberId, isActive);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(isActive ? "Compte active" : "Compte desactive");
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Equipe</CardTitle>
          <p className="text-sm text-muted-foreground">
            {activeCount} actifs / {members.length} membres
          </p>
        </div>

        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={pending}>
              Inviter un membre
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Inviter un membre</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleInvite} className="space-y-4">
              {inviteError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{inviteError}</div>
              )}
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  required
                  value={inviteForm.email}
                  aria-describedby={emailStatus !== "idle" ? "invite-email-status" : undefined}
                  onChange={(e) => {
                    setInviteForm((prev) => ({ ...prev, email: e.target.value }));
                    setEmailStatus("idle");
                    setEmailStatusMessage("");
                  }}
                  onBlur={handleEmailBlur}
                />
                {emailStatus !== "idle" && (
                  <p
                    id="invite-email-status"
                    className={`text-xs ${
                      emailStatus === "ok"
                        ? "text-emerald-600"
                        : emailStatus === "checking"
                          ? "text-muted-foreground"
                          : "text-red-600"
                    }`}
                  >
                    {emailStatusMessage}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Rôle</Label>
                <Select
                  value={inviteForm.role}
                  onValueChange={(value) =>
                    setInviteForm((prev) => ({ ...prev, role: value as UserRole }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setInviteOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={inviteLoading || emailStatus === "taken" || emailStatus === "checking"}>
                  {inviteLoading ? "Envoi..." : "Envoyer l'invitation"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Derniere connexion</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>{member.name}</TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell className="min-w-[180px]">
                    <Select
                      value={member.role}
                      onValueChange={(value) => handleRoleChange(member.id, value as UserRole)}
                      disabled={pending}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.isActive ? "default" : "secondary"}>
                      {member.isActive ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(member.lastLoginAt)}</TableCell>
                  <TableCell>
                    <Switch
                      checked={member.isActive}
                      onCheckedChange={(checked) => handleToggleActive(member.id, checked)}
                      disabled={pending}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {members.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    Aucun membre
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
