"use client";

import { useState } from "react";
import { Loader2, MessageSquare, Send, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TaskStatusBadge } from "@/components/shared/status-badge";
import {
  updateTaskStatus, assignTask, addTaskComment, approveTask,
} from "@/lib/actions/task.actions";

// ── Status transitions ────────────────────────────────────────────────────────
const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["WAITING_APPROVAL", "BLOCKED", "COMPLETED", "PENDING"],
  WAITING_APPROVAL: ["COMPLETED", "BLOCKED", "IN_PROGRESS"],
  BLOCKED: ["IN_PROGRESS", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: ["PENDING"],
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  IN_PROGRESS: "Démarrer",
  WAITING_APPROVAL: "Soumettre approbation",
  BLOCKED: "Marquer bloqué",
  COMPLETED: "Marquer terminé",
  CANCELLED: "Annuler",
};

// ── Workflow component ────────────────────────────────────────────────────────
interface TaskDetailActionsProps {
  taskId: string;
  currentStatus?: string;
  currentAssignees?: { id: string; name: string }[];
  teamMembers?: { id: string; name: string }[];
  requiredApproval?: boolean;
  approvals?: any[];
  commentMode?: boolean;
}

export function TaskDetailActions({
  taskId,
  currentStatus,
  currentAssignees = [],
  teamMembers = [],
  requiredApproval,
  approvals = [],
  commentMode = false,
}: TaskDetailActionsProps) {
  const router = useRouter();
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null);
  const [loadingAssign, setLoadingAssign] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [comment, setComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [approvalComment, setApprovalComment] = useState("");
  const [loadingApproval, setLoadingApproval] = useState<string | null>(null);

  // ── Comment mode ──────────────────────────────────────────────────────────
  if (commentMode) {
    return (
      <div className="space-y-2">
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Ajouter un commentaire..."
          rows={3}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!comment.trim() || submittingComment}
            onClick={async () => {
              if (!comment.trim()) return;
              setSubmittingComment(true);
              try {
                const res = await addTaskComment(taskId, comment.trim());
                if (res.error) {
                  toast.error(res.error);
                } else {
                  toast.success("Commentaire ajouté");
                  setComment("");
                  router.refresh();
                }
              } catch {
                toast.error("Erreur lors de l'envoi");
              } finally {
                setSubmittingComment(false);
              }
            }}
          >
            {submittingComment ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Envoyer
          </Button>
        </div>
      </div>
    );
  }

  // ── Status transitions ────────────────────────────────────────────────────
  const transitions = currentStatus ? STATUS_TRANSITIONS[currentStatus] ?? [] : [];

  async function handleStatusChange(newStatus: string) {
    setLoadingStatus(newStatus);
    try {
      const res = await updateTaskStatus(taskId, newStatus);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Statut mis à jour");
        router.refresh();
      }
    } catch {
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setLoadingStatus(null);
    }
  }

  async function handleAssign() {
    if (!selectedMember) return;
    setLoadingAssign(true);
    try {
      const res = await assignTask(taskId, selectedMember);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Tâche assignée");
        setSelectedMember("");
        router.refresh();
      }
    } catch {
      toast.error("Erreur lors de l'assignation");
    } finally {
      setLoadingAssign(false);
    }
  }

  async function handleApproval(decision: string) {
    setLoadingApproval(decision);
    try {
      const res = await approveTask(taskId, decision, approvalComment || undefined);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(decision === "APPROVED" ? "Tâche approuvée" : decision === "REJECTED" ? "Tâche rejetée" : "Tâche escaladée");
        setApprovalComment("");
        router.refresh();
      }
    } catch {
      toast.error("Erreur lors de l'approbation");
    } finally {
      setLoadingApproval(null);
    }
  }

  const unassignedMembers = teamMembers.filter(
    (m) => !currentAssignees.find((a) => a.id === m.id)
  );

  return (
    <div className="space-y-5">
      {/* Current status + transitions */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Statut actuel :</span>
          {currentStatus && <TaskStatusBadge status={currentStatus} />}
        </div>

        {transitions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {transitions.map((status) => {
              const isLoading = loadingStatus === status;
              const variant =
                status === "COMPLETED" ? "default" :
                status === "CANCELLED" ? "destructive" :
                status === "BLOCKED" ? "outline" :
                "secondary";

              return (
                <Button
                  key={status}
                  variant={variant as any}
                  size="sm"
                  disabled={loadingStatus !== null}
                  onClick={() => handleStatusChange(status)}
                >
                  {isLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  {STATUS_LABELS[status] ?? status}
                </Button>
              );
            })}
          </div>
        )}

        {transitions.length === 0 && currentStatus && (
          <p className="text-xs text-muted-foreground">Aucune transition disponible depuis ce statut</p>
        )}
      </div>

      {/* Assignees + new assignment */}
      <div className="space-y-2 pt-2 border-t">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Assignation</span>
        </div>

        {currentAssignees.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {currentAssignees.map((a) => (
              <Badge key={a.id} variant="secondary" className="text-xs">
                <span className="w-4 h-4 rounded-full bg-primary/20 inline-flex items-center justify-center text-[10px] font-bold mr-1">
                  {a.name.charAt(0)}
                </span>
                {a.name}
              </Badge>
            ))}
          </div>
        )}

        {unassignedMembers.length > 0 && (
          <div className="flex gap-2">
            <Select value={selectedMember} onValueChange={setSelectedMember}>
              <SelectTrigger className="flex-1 h-8 text-sm">
                <SelectValue placeholder="Assigner à..." />
              </SelectTrigger>
              <SelectContent>
                {unassignedMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={handleAssign} disabled={!selectedMember || loadingAssign}>
              {loadingAssign ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assigner"}
            </Button>
          </div>
        )}
      </div>

      {/* Approval workflow */}
      {requiredApproval && currentStatus === "WAITING_APPROVAL" && (
        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-medium">Décision d&apos;approbation</span>
          </div>
          <Textarea
            value={approvalComment}
            onChange={(e) => setApprovalComment(e.target.value)}
            placeholder="Commentaire (optionnel)..."
            rows={2}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700"
              disabled={loadingApproval !== null}
              onClick={() => handleApproval("APPROVED")}
            >
              {loadingApproval === "APPROVED" && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Approuver
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={loadingApproval !== null}
              onClick={() => handleApproval("REJECTED")}
            >
              {loadingApproval === "REJECTED" && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Rejeter
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={loadingApproval !== null}
              onClick={() => handleApproval("ESCALATED")}
            >
              {loadingApproval === "ESCALATED" && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Escalader
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
