"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2, Plus, Send, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TaskStatusBadge } from "@/components/shared/status-badge";
import { MentionInput } from "@/components/tasks/mention-input";
import {
  updateTaskStatus, assignTask, addTaskComment, approveTask,
  createSubtask, watchTask, unwatchTask,
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

// ── Props ─────────────────────────────────────────────────────────────────────
interface TaskDetailActionsProps {
  taskId: string;
  currentStatus?: string;
  currentAssignees?: { id: string; name: string }[];
  teamMembers?: { id: string; name: string }[];
  requiredApproval?: boolean;
  approvals?: any[];
  commentMode?: boolean;
  subtaskMode?: boolean;
  watchMode?: boolean;
  isWatching?: boolean;
  // commentMode extras
  mentionableMembers?: { id: string; name: string }[];
}

export function TaskDetailActions({
  taskId,
  currentStatus,
  currentAssignees = [],
  teamMembers = [],
  requiredApproval,
  approvals = [],
  commentMode = false,
  subtaskMode = false,
  watchMode = false,
  isWatching = false,
  mentionableMembers = [],
}: TaskDetailActionsProps) {
  const router = useRouter();

  // ── Comment mode ──────────────────────────────────────────────────────────
  const [comment, setComment] = useState("");
  const [commentMentions, setCommentMentions] = useState<string[]>([]);
  const [submittingComment, setSubmittingComment] = useState(false);

  // ── Subtask mode ──────────────────────────────────────────────────────────
  const [showSubtaskForm, setShowSubtaskForm] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [subtaskAssignee, setSubtaskAssignee] = useState("");
  const [creatingSubtask, setCreatingSubtask] = useState(false);

  // ── Watch mode ────────────────────────────────────────────────────────────
  const [watching, setWatching] = useState(isWatching);
  const [loadingWatch, setLoadingWatch] = useState(false);

  // ── Workflow state ────────────────────────────────────────────────────────
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null);
  const [loadingAssign, setLoadingAssign] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [approvalComment, setApprovalComment] = useState("");
  const [loadingApproval, setLoadingApproval] = useState<string | null>(null);

  // ── Comment mode render ───────────────────────────────────────────────────
  if (commentMode) {
    const members = mentionableMembers.length > 0 ? mentionableMembers : teamMembers;
    return (
      <div className="space-y-2">
        {members.length > 0 ? (
          <MentionInput
            value={comment}
            onChange={setComment}
            onMentionsChange={setCommentMentions}
            teamMembers={members}
            placeholder="Ajouter un commentaire... (@nom pour mentionner)"
            rows={3}
          />
        ) : (
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ajouter un commentaire..."
            rows={3}
          />
        )}
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!comment.trim() || submittingComment}
            onClick={async () => {
              if (!comment.trim()) return;
              setSubmittingComment(true);
              try {
                const res = await addTaskComment(taskId, comment.trim(), commentMentions);
                if (res.error) {
                  toast.error(res.error);
                } else {
                  toast.success("Commentaire ajouté");
                  setComment("");
                  setCommentMentions([]);
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

  // ── Subtask mode render ───────────────────────────────────────────────────
  if (subtaskMode) {
    return (
      <div>
        {!showSubtaskForm ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => setShowSubtaskForm(true)}
          >
            <Plus className="mr-2 h-3.5 w-3.5" />
            Ajouter une sous-tâche
          </Button>
        ) : (
          <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
            <Input
              value={subtaskTitle}
              onChange={(e) => setSubtaskTitle(e.target.value)}
              placeholder="Titre de la sous-tâche..."
              className="h-8 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setShowSubtaskForm(false);
                  setSubtaskTitle("");
                }
              }}
            />
            {teamMembers.length > 0 && (
              <Select value={subtaskAssignee} onValueChange={setSubtaskAssignee}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Assigner à (optionnel)..." />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowSubtaskForm(false);
                  setSubtaskTitle("");
                  setSubtaskAssignee("");
                }}
              >
                Annuler
              </Button>
              <Button
                size="sm"
                disabled={!subtaskTitle.trim() || creatingSubtask}
                onClick={async () => {
                  if (!subtaskTitle.trim()) return;
                  setCreatingSubtask(true);
                  try {
                    const res = await createSubtask(taskId, {
                      title: subtaskTitle.trim(),
                      assigneeId: subtaskAssignee || undefined,
                    });
                    if (res.error) {
                      toast.error(res.error);
                    } else {
                      toast.success("Sous-tâche créée");
                      setSubtaskTitle("");
                      setSubtaskAssignee("");
                      setShowSubtaskForm(false);
                      router.refresh();
                    }
                  } catch {
                    toast.error("Erreur lors de la création");
                  } finally {
                    setCreatingSubtask(false);
                  }
                }}
              >
                {creatingSubtask ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-2 h-3.5 w-3.5" />}
                Créer
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Watch mode render ─────────────────────────────────────────────────────
  if (watchMode) {
    return (
      <Button
        variant={watching ? "secondary" : "outline"}
        size="sm"
        className="w-full"
        disabled={loadingWatch}
        onClick={async () => {
          setLoadingWatch(true);
          try {
            const res = watching
              ? await unwatchTask(taskId)
              : await watchTask(taskId);
            if (res.error) {
              toast.error(res.error);
            } else {
              setWatching(!watching);
              toast.success(watching ? "Vous ne suivez plus cette tâche" : "Vous suivez maintenant cette tâche");
              router.refresh();
            }
          } catch {
            toast.error("Erreur");
          } finally {
            setLoadingWatch(false);
          }
        }}
      >
        {loadingWatch ? (
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
        ) : watching ? (
          <EyeOff className="mr-2 h-3.5 w-3.5" />
        ) : (
          <Eye className="mr-2 h-3.5 w-3.5" />
        )}
        {watching ? "Ne plus suivre" : "Suivre la tâche"}
      </Button>
    );
  }

  // ── Default: workflow mode ────────────────────────────────────────────────
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
        toast.success(
          decision === "APPROVED" ? "Tâche approuvée" :
          decision === "REJECTED" ? "Tâche rejetée" :
          "Tâche escaladée"
        );
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
