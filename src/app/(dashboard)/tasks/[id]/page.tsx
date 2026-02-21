import { notFound } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle, ArrowLeft, ArrowRight, Bot, CheckCircle2, Clock, ExternalLink,
  Eye, GitBranch, Layers, ListTree, MessageSquare, Paperclip, Plus,
  ShieldCheck, Tag, User, Calendar, Copy, Trash2, Timer,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { TaskStatusBadge, PriorityBadge } from "@/components/shared/status-badge";
import { TaskDetailActions } from "@/components/tasks/task-detail-actions";
import { TaskEditDialog } from "@/components/tasks/task-edit-dialog";
import { TimeTracker } from "@/components/tasks/time-tracker";
import { TaskDeleteDuplicate } from "@/components/tasks/task-delete-duplicate";
import { TaskAttachments } from "@/components/tasks/task-attachments";
import { getTaskById, getTaskActivity, getTeamMembers } from "@/lib/actions/task.actions";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface PageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: PageProps) {
  const result = await getTaskById(params.id);
  return { title: result.data ? `${result.data.title} | Tâches` : "Tâche | Horion ERP" };
}

export default async function TaskDetailPage({ params }: PageProps) {
  const [taskResult, activityResult, membersResult] = await Promise.all([
    getTaskById(params.id),
    getTaskActivity(params.id),
    getTeamMembers(),
  ]);

  if (taskResult.error || !taskResult.data) notFound();

  const task = taskResult.data;
  const activity = activityResult.data ?? [];
  const teamMembers = membersResult.data ?? [];

  const assignees = task.assignments?.map((a: any) => a.user) ?? [];
  const approvals = task.approvals ?? [];
  const children = task.children ?? [];
  const dependencies = task.dependencies ?? [];
  const dependents = task.dependents ?? [];
  const watchers = task.watchers ?? [];
  const agentExecs = task.agentExecutions ?? [];
  const tags = task.tags ?? [];
  const attachments = (task as any).attachments ?? [];

  // Subtask progress
  const completedChildren = children.filter((c: any) => c.status === "COMPLETED" || c.status === "CANCELLED").length;
  const subtaskPercent = children.length > 0 ? Math.round((completedChildren / children.length) * 100) : 0;

  const DECISION_LABELS: Record<string, string> = { APPROVED: "Approuvé", REJECTED: "Rejeté", ESCALATED: "Escaladé" };
  const DECISION_COLORS: Record<string, string> = { APPROVED: "text-green-600", REJECTED: "text-red-600", ESCALATED: "text-yellow-600" };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Breadcrumb + Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="sm" asChild className="mt-1">
          <Link href="/tasks"><ArrowLeft className="h-4 w-4 mr-1" />Retour</Link>
        </Button>
        <div className="flex-1 min-w-0">
          {/* Parent breadcrumb */}
          {task.parent && (
            <Link href={`/tasks/${task.parent.id}`} className="text-xs text-muted-foreground hover:underline flex items-center gap-1 mb-1">
              <ArrowLeft className="h-3 w-3" /> Tâche parent: {task.parent.title}
            </Link>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="capitalize text-xs">{task.module}</Badge>
            {task.taskType && <Badge variant="secondary" className="text-xs">{task.taskType}</Badge>}
            {task.ownerType === "AI_AGENT" && (
              <Badge className="bg-purple-100 text-purple-700 text-xs"><Bot className="h-3 w-3 mr-1" />Agent IA</Badge>
            )}
            {task.ownerType === "SYSTEM" && (
              <Badge className="bg-gray-100 text-gray-700 text-xs">Système</Badge>
            )}
            {task.slaBreach && (
              <Badge className="bg-red-100 text-red-700 text-xs"><AlertTriangle className="h-3 w-3 mr-1" />SLA dépassé</Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold mt-1 leading-tight">{task.title}</h1>
          {task.description && <p className="text-muted-foreground mt-1">{task.description}</p>}
          {tags.length > 0 && (
            <div className="flex items-center gap-1 mt-2">
              <Tag className="h-3 w-3 text-muted-foreground" />
              {tags.map((tag: string) => (
                <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
              ))}
            </div>
          )}
          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-3">
            <TaskEditDialog task={{
              id: task.id,
              title: task.title,
              description: task.description,
              priority: task.priority,
              module: task.module,
              tags: task.tags ?? [],
              estimatedHours: task.estimatedHours,
              riskLevel: task.riskLevel,
            }} />
            <TaskDeleteDuplicate taskId={task.id} taskTitle={task.title} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Workflow */}
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

          {/* Subtasks */}
          {(children.length > 0 || task.parentTaskId === null) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ListTree className="h-4 w-4 text-indigo-500" />
                  Sous-tâches
                  {children.length > 0 && (
                    <span className="ml-auto text-xs text-muted-foreground font-normal">
                      {completedChildren}/{children.length} ({subtaskPercent}%)
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {children.length > 0 && (
                  <div className="mb-3">
                    <Progress value={subtaskPercent} className="h-2" />
                  </div>
                )}
                {children.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-3">Aucune sous-tâche</p>
                ) : (
                  <div className="space-y-1">
                    {children.map((child: any) => (
                      <Link
                        key={child.id}
                        href={`/tasks/${child.id}`}
                        className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 transition-colors"
                      >
                        <CheckCircle2 className={cn("h-4 w-4 shrink-0",
                          child.status === "COMPLETED" ? "text-green-500" :
                          child.status === "BLOCKED" ? "text-red-500" :
                          child.status === "IN_PROGRESS" ? "text-blue-500" :
                          "text-gray-300"
                        )} />
                        <span className={cn("text-sm flex-1 truncate", child.status === "COMPLETED" && "line-through text-muted-foreground")}>
                          {child.title}
                        </span>
                        <TaskStatusBadge status={child.status} />
                        {child.assignments?.[0]?.user && (
                          <span className="text-xs text-muted-foreground">{child.assignments[0].user.name}</span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
                <div className="mt-3">
                  <TaskDetailActions taskId={task.id} subtaskMode teamMembers={teamMembers} />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Dependencies */}
          {(dependencies.length > 0 || dependents.length > 0) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-orange-500" />
                  Dépendances
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {dependencies.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Bloqué par ({dependencies.length})</h4>
                    <div className="space-y-1">
                      {dependencies.map((dep: any) => (
                        <Link key={dep.id} href={`/tasks/${dep.dependsOn.id}`}
                          className="flex items-center gap-2 p-2 rounded hover:bg-muted/50">
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm flex-1 truncate">{dep.dependsOn.title}</span>
                          <TaskStatusBadge status={dep.dependsOn.status} />
                          <Badge variant="outline" className="text-xs">{dep.type}</Badge>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {dependents.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Bloque ({dependents.length})</h4>
                    <div className="space-y-1">
                      {dependents.map((dep: any) => (
                        <Link key={dep.id} href={`/tasks/${dep.task.id}`}
                          className="flex items-center gap-2 p-2 rounded hover:bg-muted/50">
                          <ArrowLeft className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm flex-1 truncate">{dep.task.title}</span>
                          <TaskStatusBadge status={dep.task.status} />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Agent Executions */}
          {agentExecs.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bot className="h-4 w-4 text-purple-500" />
                  Exécutions Agent IA
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {agentExecs.map((exec: any) => (
                    <div key={exec.id} className="flex items-center gap-3 p-2 rounded border text-sm">
                      <Badge className={cn("text-xs",
                        exec.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                        exec.status === "FAILED" ? "bg-red-100 text-red-700" :
                        exec.status === "RUNNING" ? "bg-blue-100 text-blue-700" :
                        "bg-gray-100 text-gray-700"
                      )}>{exec.status}</Badge>
                      <span className="font-medium">{exec.agentName}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{formatDate(exec.createdAt, true)}</span>
                      {exec.error && <span className="text-xs text-red-600 truncate max-w-[200px]">{exec.error}</span>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

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
                    {task.order.contact && <div className="text-sm text-muted-foreground">{task.order.contact.name}</div>}
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/orders/${task.entityId}`}>Voir<ExternalLink className="ml-2 h-3.5 w-3.5" /></Link>
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
                  {approvals.length > 0 && <Badge variant="secondary" className="ml-auto text-xs">{approvals.length}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {approvals.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">En attente d&apos;approbation</p>
                ) : (
                  <div className="space-y-3">
                    {approvals.map((a: any) => (
                      <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg border">
                        <ShieldCheck className={cn("h-5 w-5 mt-0.5 shrink-0", DECISION_COLORS[a.decision])} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={cn("font-semibold text-sm", DECISION_COLORS[a.decision])}>{DECISION_LABELS[a.decision]}</span>
                            <span className="text-xs text-muted-foreground">par {a.user?.name ?? "?"}</span>
                            <span className="text-xs text-muted-foreground ml-auto">{formatDate(a.decidedAt, true)}</span>
                          </div>
                          {a.comment && <p className="text-sm text-muted-foreground mt-1">{a.comment}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Activity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-purple-500" />
                Activité & Commentaires
                {activity.length > 0 && <Badge variant="secondary" className="ml-auto text-xs">{activity.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucune activité</p>
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
                            <div className="mt-1 text-sm bg-muted/50 rounded-lg p-2.5 border">{comment}</div>
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
              <TaskDetailActions
                taskId={task.id}
                commentMode
                teamMembers={teamMembers}
                mentionableMembers={teamMembers}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Details */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm text-muted-foreground">Détails</CardTitle></CardHeader>
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
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Owner</span>
                <Badge variant={task.ownerType === "AI_AGENT" ? "default" : "outline"} className="text-xs">
                  {task.ownerType === "AI_AGENT" ? "Agent IA" : task.ownerType === "SYSTEM" ? "Système" : "Humain"}
                </Badge>
              </div>
              {task.agentName && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Agent</span>
                  <span className="font-medium text-purple-600">{task.agentName}</span>
                </div>
              )}
              {task.riskLevel && task.riskLevel !== "LOW" && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Risque</span>
                  <Badge variant="outline">{task.riskLevel}</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* SLA */}
          <Card className={cn(task.slaBreach && "border-red-300 bg-red-50/50 dark:bg-red-950/10")}>
            <CardHeader className="pb-3">
              <CardTitle className={cn("text-sm flex items-center gap-2", task.slaBreach ? "text-red-600" : "text-muted-foreground")}>
                <Clock className="h-4 w-4" />SLA & Délais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {task.slaDeadline ? (
                <div className={cn("flex items-center gap-2", task.slaBreach && "text-red-600 font-semibold")}>
                  {task.slaBreach && <AlertTriangle className="h-4 w-4" />}
                  <span>{formatDate(task.slaDeadline, true)}</span>
                  {task.slaBreach && <Badge className="bg-red-100 text-red-700 text-xs">DÉPASSÉ</Badge>}
                </div>
              ) : <span className="text-muted-foreground">Pas de SLA</span>}
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
                <User className="h-4 w-4" />Assigné à
              </CardTitle>
            </CardHeader>
            <CardContent>
              {assignees.length === 0 ? (
                <p className="text-sm text-muted-foreground">Non assigné</p>
              ) : (
                <div className="space-y-2">
                  {assignees.map((u: any) => (
                    <div key={u.id} className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {u.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{u.name}</div>
                        <div className="text-xs text-muted-foreground">{u.role}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Time Tracking */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Timer className="h-4 w-4" />Suivi du temps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TimeTracker
                taskId={task.id}
                estimatedHours={task.estimatedHours ?? null}
                actualHours={task.actualHours ?? null}
              />
            </CardContent>
          </Card>

          {/* Attachments */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Pièces jointes
                {attachments.length > 0 && (
                  <span className="ml-auto text-xs font-normal">({attachments.length})</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TaskAttachments taskId={task.id} attachments={attachments} />
            </CardContent>
          </Card>

          {/* Watchers */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Eye className="h-4 w-4" />Observateurs ({watchers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {watchers.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucun observateur</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {watchers.map((w: any) => (
                    <Badge key={w.id} variant="outline" className="text-xs">{w.user.name}</Badge>
                  ))}
                </div>
              )}
              <div className="mt-2">
                <TaskDetailActions taskId={task.id} watchMode />
              </div>
            </CardContent>
          </Card>

          {/* Dates */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />Dates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between"><span>Créé</span><span>{formatDate(task.createdAt, true)}</span></div>
              <div className="flex justify-between"><span>Modifié</span><span>{formatDate(task.updatedAt, true)}</span></div>
              {task.startedAt && <div className="flex justify-between"><span>Démarré</span><span>{formatDate(task.startedAt, true)}</span></div>}
              {task.completedAt && <div className="flex justify-between text-green-600"><span>Terminé</span><span>{formatDate(task.completedAt, true)}</span></div>}
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Tag className="h-4 w-4" />Liens rapides
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                <Link href="/tasks"><ArrowLeft className="mr-2 h-4 w-4" />Toutes les tâches</Link>
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                <Link href="/tasks/board"><Layers className="mr-2 h-4 w-4" />Vue Kanban</Link>
              </Button>
              {task.module && task.module !== "manual" && (
                <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                  <Link href={`/${task.module}`}><ExternalLink className="mr-2 h-4 w-4" />OS {task.module}</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

    </div>
  );
}
