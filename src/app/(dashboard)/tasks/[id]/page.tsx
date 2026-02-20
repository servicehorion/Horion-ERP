import { notFound } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Clock, ExternalLink,
  MessageSquare, ShieldCheck, User, Calendar, Tag, Layers,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TaskStatusBadge, PriorityBadge } from "@/components/shared/status-badge";
import { TaskDetailActions } from "@/components/tasks/task-detail-actions";
import { getTaskById, getTaskActivity, getTeamMembers } from "@/lib/actions/task.actions";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface PageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: PageProps) {
  const result = await getTaskById(params.id);
  return {
    title: result.data ? `${result.data.title} | Tâches` : "Tâche | Horion ERP",
  };
}

export default async function TaskDetailPage({ params }: PageProps) {
  const [taskResult, activityResult, membersResult] = await Promise.all([
    getTaskById(params.id),
    getTaskActivity(params.id),
    getTeamMembers(),
  ]);

  if (taskResult.error || !taskResult.data) {
    notFound();
  }

  const task = taskResult.data;
  const activity = activityResult.data ?? [];
  const teamMembers = membersResult.data ?? [];

  const assignees = task.assignments?.map((a: any) => a.user) ?? [];
  const approvals = task.approvals ?? [];

  const DECISION_LABELS: Record<string, string> = {
    APPROVED: "Approuvé",
    REJECTED: "Rejeté",
    ESCALATED: "Escaladé",
  };

  const DECISION_COLORS: Record<string, string> = {
    APPROVED: "text-green-600",
    REJECTED: "text-red-600",
    ESCALATED: "text-yellow-600",
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="sm" asChild className="mt-1">
          <Link href="/tasks">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="capitalize text-xs">{task.module}</Badge>
            {task.taskType && <Badge variant="secondary" className="text-xs">{task.taskType}</Badge>}
            {task.slaBreach && (
              <Badge className="bg-red-100 text-red-700 text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />SLA dépassé
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold mt-1 leading-tight">{task.title}</h1>
          {task.description && (
            <p className="text-muted-foreground mt-1">{task.description}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Status Workflow */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-500" />
                Workflow
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TaskDetailActions
                taskId={task.id}
                currentStatus={task.status}
                currentAssignees={assignees.map((a: any) => ({ id: a.id, name: a.name }))}
                teamMembers={teamMembers}
                requiredApproval={task.requiredApproval}
                approvals={approvals}
              />
            </CardContent>
          </Card>

          {/* Linked Entity */}
          {task.order && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-blue-500" />
                  Commande liée
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <div className="font-semibold">{task.order.orderNumber}</div>
                    {task.order.contact && (
                      <div className="text-sm text-muted-foreground">{task.order.contact.name}</div>
                    )}
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/orders/${task.entityId}`}>
                      Voir la commande
                      <ExternalLink className="ml-2 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Approvals */}
          {task.requiredApproval && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-yellow-500" />
                  Approbations
                  {approvals.length > 0 && (
                    <Badge variant="secondary" className="ml-auto text-xs">{approvals.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {approvals.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-4 text-center">
                    En attente d&apos;approbation
                  </div>
                ) : (
                  <div className="space-y-3">
                    {approvals.map((approval: any) => (
                      <div key={approval.id} className="flex items-start gap-3 p-3 rounded-lg border">
                        <ShieldCheck className={cn("h-5 w-5 mt-0.5 shrink-0", DECISION_COLORS[approval.decision])} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn("font-semibold text-sm", DECISION_COLORS[approval.decision])}>
                              {DECISION_LABELS[approval.decision]}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              par {approval.decidedBy?.name ?? "Inconnu"}
                            </span>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {formatDate(approval.decidedAt, true)}
                            </span>
                          </div>
                          {approval.comment && (
                            <p className="text-sm text-muted-foreground mt-1">{approval.comment}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Activity + Comments */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-purple-500" />
                Activité & Commentaires
                {activity.length > 0 && (
                  <Badge variant="secondary" className="ml-auto text-xs">{activity.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activity.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  Aucune activité enregistrée
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {activity.map((entry: any) => {
                    const isComment = entry.action === "task.comment";
                    const comment = isComment ? entry.newValue?.comment : null;
                    return (
                      <div key={entry.id} className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-bold">
                          {entry.user?.name?.charAt(0)?.toUpperCase() ?? "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{entry.user?.name ?? "Système"}</span>
                            <span className="text-xs text-muted-foreground">{formatDate(entry.createdAt, true)}</span>
                          </div>
                          {isComment && comment ? (
                            <div className="mt-1 text-sm bg-muted/50 rounded-lg p-2.5 border">
                              {comment}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">{entry.action}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <Separator />

              {/* Comment form */}
              <TaskCommentFormWrapper taskId={task.id} />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Task Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground">Détails</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Statut</span>
                <TaskStatusBadge status={task.status} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Priorité</span>
                <PriorityBadge priority={task.priority} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Module</span>
                <Badge variant="outline" className="capitalize">{task.module}</Badge>
              </div>
              {task.riskLevel && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Risque</span>
                  <Badge variant="outline">{task.riskLevel}</Badge>
                </div>
              )}
              {task.ownerType && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Owner</span>
                  <span className="font-medium">{task.ownerType}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* SLA */}
          <Card className={cn(task.slaBreach && "border-red-300 bg-red-50/50 dark:bg-red-950/10")}>
            <CardHeader className="pb-3">
              <CardTitle className={cn("text-sm flex items-center gap-2", task.slaBreach ? "text-red-600" : "text-muted-foreground")}>
                <Clock className="h-4 w-4" />
                SLA & Délais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {task.slaDeadline ? (
                <div className={cn("flex items-center gap-2", task.slaBreach && "text-red-600 font-semibold")}>
                  {task.slaBreach && <AlertTriangle className="h-4 w-4" />}
                  <span>{formatDate(task.slaDeadline, true)}</span>
                  {task.slaBreach && <Badge className="bg-red-100 text-red-700 text-xs">DÉPASSÉ</Badge>}
                </div>
              ) : (
                <span className="text-muted-foreground">Pas de SLA défini</span>
              )}
              {task.completedAt && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Terminé {formatDate(task.completedAt, true)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assignees */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4" />
                Assigné à
              </CardTitle>
            </CardHeader>
            <CardContent>
              {assignees.length === 0 ? (
                <p className="text-sm text-muted-foreground">Non assigné</p>
              ) : (
                <div className="space-y-2">
                  {assignees.map((user: any) => (
                    <div key={user.id} className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {user.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{user.name}</div>
                        <div className="text-xs text-muted-foreground">{user.role}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timestamps */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Dates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Créé</span>
                <span>{formatDate(task.createdAt, true)}</span>
              </div>
              <div className="flex justify-between">
                <span>Modifié</span>
                <span>{formatDate(task.updatedAt, true)}</span>
              </div>
              {task.completedAt && (
                <div className="flex justify-between text-green-600">
                  <span>Terminé</span>
                  <span>{formatDate(task.completedAt, true)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Related links */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Liens rapides
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                <Link href="/tasks">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Toutes les tâches
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                <Link href="/tasks/board">
                  <Layers className="mr-2 h-4 w-4" />
                  Vue Kanban
                </Link>
              </Button>
              {task.module && task.module !== "manual" && (
                <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                  <Link href={`/${task.module}`}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    OS {task.module}
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Inline wrapper — actual form is in client component
function TaskCommentFormWrapper({ taskId }: { taskId: string }) {
  return <TaskDetailActions taskId={taskId} commentMode />;
}
