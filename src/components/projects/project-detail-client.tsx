"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3, Calendar, CheckCircle2, Clock, Flag,
  Layers, Loader2, Plus, Settings, Trash2, Users, Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  addProjectMember, removeProjectMember, createMilestone,
  updateMilestone, createSprint, updateSprintStatus,
  assignTaskToProject, updateProject,
} from "@/lib/actions/project.actions";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

interface TeamMember { id: string; name: string; email: string }

interface ProjectDetailClientProps {
  project: {
    id: string;
    name: string;
    description?: string | null;
    status: string;
    color: string;
    startDate?: string | null;
    endDate?: string | null;
    budgetTotal?: number | null;
    budgetCurrency?: string;
    members: {
      userId: string; role: string; hourlyRate?: number | null;
      user: { id: string; name: string; avatarUrl?: string | null; email: string };
    }[];
    milestones: { id: string; name: string; status: string; dueDate?: string | null }[];
    phases: { id: string; name: string; order: number; color: string }[];
    sprints: { id: string; name: string; status: string; startDate?: string | null; endDate?: string | null; goal?: string | null }[];
    budgets: { id: string; category: string; label: string; planned: number; actual: number; currency: string }[];
    tasks: {
      id: string; title: string; status: string; priority: string;
      dueDate?: string | null; storyPoints?: number | null;
      assignments: { user: { name: string; avatarUrl?: string | null } }[];
      _count?: { children: number };
    }[];
  };
  teamMembers: TeamMember[];
  currentUserId: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const TASK_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: "En attente", color: "bg-gray-100 text-gray-700" },
  IN_PROGRESS: { label: "En cours", color: "bg-blue-100 text-blue-700" },
  WAITING_APPROVAL: { label: "En approbation", color: "bg-purple-100 text-purple-700" },
  BLOCKED: { label: "Bloqué", color: "bg-red-100 text-red-700" },
  COMPLETED: { label: "Terminé", color: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Annulé", color: "bg-gray-100 text-gray-500" },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  LOW: { label: "Faible", color: "text-gray-500" },
  NORMAL: { label: "Normale", color: "text-blue-600" },
  HIGH: { label: "Haute", color: "text-amber-600" },
  URGENT: { label: "Urgente", color: "text-orange-600" },
  CRITICAL: { label: "Critique", color: "text-red-600" },
};

const MILESTONE_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: "En attente", color: "bg-gray-100 text-gray-700" },
  IN_PROGRESS: { label: "En cours", color: "bg-blue-100 text-blue-700" },
  ACHIEVED: { label: "Atteint", color: "bg-green-100 text-green-700" },
  MISSED: { label: "Manqué", color: "bg-red-100 text-red-700" },
  CANCELLED: { label: "Annulé", color: "bg-gray-100 text-gray-500" },
};

const SPRINT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PLANNING: { label: "Planification", color: "bg-slate-100 text-slate-700" },
  ACTIVE: { label: "Actif", color: "bg-green-100 text-green-700" },
  COMPLETED: { label: "Terminé", color: "bg-blue-100 text-blue-700" },
  CANCELLED: { label: "Annulé", color: "bg-gray-100 text-gray-500" },
};

// ── Main component ─────────────────────────────────────────────────────────────

export function ProjectDetailClient({
  project,
  teamMembers,
  currentUserId,
}: ProjectDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState("tasks");

  const refresh = () => startTransition(() => { router.refresh(); });

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="mb-4">
        <TabsTrigger value="tasks" className="gap-1.5">
          <Layers className="h-3.5 w-3.5" />
          Tâches ({project.tasks.length})
        </TabsTrigger>
        <TabsTrigger value="sprints" className="gap-1.5">
          <Zap className="h-3.5 w-3.5" />
          Sprints ({project.sprints.length})
        </TabsTrigger>
        <TabsTrigger value="milestones" className="gap-1.5">
          <Flag className="h-3.5 w-3.5" />
          Jalons ({project.milestones.length})
        </TabsTrigger>
        <TabsTrigger value="budget" className="gap-1.5">
          <BarChart3 className="h-3.5 w-3.5" />
          Budget
        </TabsTrigger>
        <TabsTrigger value="members" className="gap-1.5">
          <Users className="h-3.5 w-3.5" />
          Membres ({project.members.length})
        </TabsTrigger>
      </TabsList>

      {/* ── Tasks ── */}
      <TabsContent value="tasks">
        <TasksTab tasks={project.tasks} projectId={project.id} onRefresh={refresh} />
      </TabsContent>

      {/* ── Sprints ── */}
      <TabsContent value="sprints">
        <SprintsTab
          sprints={project.sprints}
          tasks={project.tasks}
          projectId={project.id}
          onRefresh={refresh}
        />
      </TabsContent>

      {/* ── Milestones ── */}
      <TabsContent value="milestones">
        <MilestonesTab milestones={project.milestones} projectId={project.id} onRefresh={refresh} />
      </TabsContent>

      {/* ── Budget ── */}
      <TabsContent value="budget">
        <BudgetTab budgets={project.budgets} projectId={project.id} budgetTotal={project.budgetTotal} onRefresh={refresh} />
      </TabsContent>

      {/* ── Members ── */}
      <TabsContent value="members">
        <MembersTab
          members={project.members}
          teamMembers={teamMembers}
          projectId={project.id}
          currentUserId={currentUserId}
          onRefresh={refresh}
        />
      </TabsContent>
    </Tabs>
  );
}

// ── Tasks Tab ─────────────────────────────────────────────────────────────────

function TasksTab({
  tasks,
  projectId,
  onRefresh,
}: {
  tasks: ProjectDetailClientProps["project"]["tasks"];
  projectId: string;
  onRefresh: () => void;
}) {
  const completedCount = tasks.filter((t) => t.status === "COMPLETED").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {completedCount}/{tasks.length} tâches terminées
        </p>
        <Button size="sm" asChild>
          <a href="/tasks">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Ajouter une tâche
          </a>
        </Button>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          Aucune tâche liée à ce projet.
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => {
            const st = TASK_STATUS_CONFIG[task.status] ?? TASK_STATUS_CONFIG.PENDING;
            const pr = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.NORMAL;
            return (
              <a key={task.id} href={`/tasks/${task.id}`}>
                <Card className="hover:shadow-sm transition-shadow cursor-pointer">
                  <CardContent className="p-3 flex items-center gap-3">
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", st.color)}>
                      {st.label}
                    </span>
                    <span className="flex-1 text-sm font-medium truncate">{task.title}</span>
                    {task.storyPoints != null && (
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                        {task.storyPoints}pt
                      </span>
                    )}
                    <span className={cn("text-xs font-medium", pr.color)}>{pr.label}</span>
                    <div className="flex -space-x-1">
                      {task.assignments.slice(0, 3).map((a, i) => (
                        <div
                          key={i}
                          className="w-5 h-5 rounded-full bg-primary/20 border border-background flex items-center justify-center text-[8px] font-medium"
                          title={a.user.name}
                        >
                          {a.user.name.charAt(0)}
                        </div>
                      ))}
                    </div>
                    {task.dueDate && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(task.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      </span>
                    )}
                  </CardContent>
                </Card>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Sprints Tab ───────────────────────────────────────────────────────────────

function SprintsTab({
  sprints,
  tasks,
  projectId,
  onRefresh,
}: {
  sprints: ProjectDetailClientProps["project"]["sprints"];
  tasks: ProjectDetailClientProps["project"]["tasks"];
  projectId: string;
  onRefresh: () => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", goal: "", startDate: "", endDate: "" });

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error("Nom du sprint requis"); return; }
    setLoading(true);
    try {
      const res = await createSprint(projectId, {
        name: form.name.trim(),
        goal: form.goal.trim() || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("Sprint créé");
        setCreateOpen(false);
        setForm({ name: "", goal: "", startDate: "", endDate: "" });
        onRefresh();
      }
    } catch {
      toast.error("Erreur");
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (sprintId: string) => {
    const res = await updateSprintStatus(sprintId, "ACTIVE");
    if (res.error) toast.error(res.error);
    else { toast.success("Sprint activé"); onRefresh(); }
  };

  const handleComplete = async (sprintId: string) => {
    const res = await updateSprintStatus(sprintId, "COMPLETED");
    if (res.error) toast.error(res.error);
    else { toast.success("Sprint terminé"); onRefresh(); }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Nouveau sprint
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Créer un sprint</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nom <span className="text-red-500">*</span></Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Sprint 1" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label>Objectif</Label>
                <Input value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} placeholder="But du sprint..." />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Début</Label>
                  <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label>Fin</Label>
                  <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="text-sm" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {sprints.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">Aucun sprint créé.</div>
      ) : (
        <div className="space-y-3">
          {sprints.map((sprint) => {
            const cfg = SPRINT_STATUS_CONFIG[sprint.status] ?? SPRINT_STATUS_CONFIG.PLANNING;
            return (
              <Card key={sprint.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", cfg.color)}>
                          {cfg.label}
                        </span>
                        <span className="font-medium">{sprint.name}</span>
                      </div>
                      {sprint.goal && (
                        <p className="text-sm text-muted-foreground">{sprint.goal}</p>
                      )}
                      {(sprint.startDate || sprint.endDate) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {sprint.startDate && new Date(sprint.startDate).toLocaleDateString("fr-FR")}
                          {sprint.startDate && sprint.endDate && " → "}
                          {sprint.endDate && new Date(sprint.endDate).toLocaleDateString("fr-FR")}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {sprint.status === "PLANNING" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleActivate(sprint.id)}>
                          Démarrer
                        </Button>
                      )}
                      {sprint.status === "ACTIVE" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleComplete(sprint.id)}>
                          Terminer
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Milestones Tab ────────────────────────────────────────────────────────────

function MilestonesTab({
  milestones,
  projectId,
  onRefresh,
}: {
  milestones: ProjectDetailClientProps["project"]["milestones"];
  projectId: string;
  onRefresh: () => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", dueDate: "" });

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error("Nom requis"); return; }
    setLoading(true);
    try {
      const res = await createMilestone(projectId, {
        name: form.name.trim(),
        dueDate: form.dueDate || undefined,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("Jalon créé");
        setCreateOpen(false);
        setForm({ name: "", dueDate: "" });
        onRefresh();
      }
    } catch {
      toast.error("Erreur");
    } finally {
      setLoading(false);
    }
  };

  const handleAchieve = async (id: string) => {
    const res = await updateMilestone(id, { status: "ACHIEVED" });
    if (res.error) toast.error(res.error);
    else { toast.success("Jalon atteint !"); onRefresh(); }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Nouveau jalon
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Créer un jalon</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nom <span className="text-red-500">*</span></Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: MVP livré" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label>Date cible</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="text-sm" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {milestones.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">Aucun jalon défini.</div>
      ) : (
        <div className="space-y-2">
          {milestones.map((ms) => {
            const cfg = MILESTONE_STATUS_CONFIG[ms.status] ?? MILESTONE_STATUS_CONFIG.PENDING;
            const isLate = ms.dueDate && ms.status !== "ACHIEVED" && new Date(ms.dueDate) < new Date();
            return (
              <Card key={ms.id}>
                <CardContent className="p-4 flex items-center gap-3">
                  <Flag className={cn("h-4 w-4 flex-shrink-0", ms.status === "ACHIEVED" ? "text-green-600" : isLate ? "text-red-500" : "text-amber-500")} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{ms.name}</p>
                    {ms.dueDate && (
                      <p className={cn("text-xs mt-0.5", isLate ? "text-red-600" : "text-muted-foreground")}>
                        {isLate ? "En retard — " : ""}
                        {new Date(ms.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    )}
                  </div>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", cfg.color)}>
                    {cfg.label}
                  </span>
                  {ms.status === "IN_PROGRESS" || ms.status === "PENDING" ? (
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-green-600" onClick={() => handleAchieve(ms.id)}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      Atteint
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Budget Tab ────────────────────────────────────────────────────────────────

function BudgetTab({
  budgets,
  projectId,
  budgetTotal,
  onRefresh,
}: {
  budgets: ProjectDetailClientProps["project"]["budgets"];
  projectId: string;
  budgetTotal?: number | null;
  onRefresh: () => void;
}) {
  const totalPlanned = budgets.reduce((s, b) => s + Number(b.planned), 0);
  const totalActual = budgets.reduce((s, b) => s + Number(b.actual), 0);
  const overBudget = totalPlanned > 0 && totalActual > totalPlanned;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 bg-muted/40">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold">{totalPlanned.toLocaleString("fr-FR")}</p>
            <p className="text-xs text-muted-foreground">Planifié (XAF)</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-muted/40">
          <CardContent className="p-3 text-center">
            <p className={cn("text-lg font-bold", overBudget && "text-red-600")}>
              {totalActual.toLocaleString("fr-FR")}
            </p>
            <p className="text-xs text-muted-foreground">Réel (XAF)</p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-muted/40">
          <CardContent className="p-3 text-center">
            <p className={cn("text-lg font-bold", overBudget ? "text-red-600" : "text-green-600")}>
              {(totalPlanned - totalActual).toLocaleString("fr-FR")}
            </p>
            <p className="text-xs text-muted-foreground">Restant (XAF)</p>
          </CardContent>
        </Card>
      </div>

      {budgets.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          Aucune ligne budgétaire. Les entrées de temps avec taux horaire alimenteront automatiquement la catégorie LABOR.
        </div>
      ) : (
        <div className="space-y-2">
          {budgets.map((b) => {
            const pct = Number(b.planned) > 0
              ? Math.round((Number(b.actual) / Number(b.planned)) * 100)
              : 0;
            const over = Number(b.actual) > Number(b.planned);
            return (
              <Card key={b.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-muted-foreground uppercase mr-2">{b.category}</span>
                      <span className="text-sm font-medium">{b.label}</span>
                    </div>
                    <span className={cn("text-sm font-semibold", over && "text-red-600")}>
                      {Number(b.actual).toLocaleString("fr-FR")} / {Number(b.planned).toLocaleString("fr-FR")} {b.currency}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={Math.min(100, pct)}
                      className={cn("h-1.5 flex-1", over && "[&>div]:bg-red-500")}
                    />
                    <span className={cn("text-xs font-medium w-10 text-right", over && "text-red-600")}>
                      {pct}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Members Tab ───────────────────────────────────────────────────────────────

function MembersTab({
  members,
  teamMembers,
  projectId,
  currentUserId,
  onRefresh,
}: {
  members: ProjectDetailClientProps["project"]["members"];
  teamMembers: TeamMember[];
  projectId: string;
  currentUserId: string;
  onRefresh: () => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ userId: "", role: "MEMBER", hourlyRate: "" });

  const memberIds = new Set(members.map((m) => m.userId));
  const availableMembers = teamMembers.filter((m) => !memberIds.has(m.id));

  const handleAdd = async () => {
    if (!form.userId) { toast.error("Sélectionnez un membre"); return; }
    setLoading(true);
    try {
      const res = await addProjectMember(
        projectId,
        form.userId,
        form.role as any,
        form.hourlyRate ? Number(form.hourlyRate) : undefined
      );
      if (res.error) toast.error(res.error);
      else {
        toast.success("Membre ajouté");
        setAddOpen(false);
        setForm({ userId: "", role: "MEMBER", hourlyRate: "" });
        onRefresh();
      }
    } catch {
      toast.error("Erreur");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (userId: string) => {
    const res = await removeProjectMember(projectId, userId);
    if (res.error) toast.error(res.error);
    else { toast.success("Membre retiré"); onRefresh(); }
  };

  const ROLE_CONFIG = {
    OWNER: { label: "Propriétaire", color: "bg-purple-100 text-purple-700" },
    MANAGER: { label: "Manager", color: "bg-blue-100 text-blue-700" },
    MEMBER: { label: "Membre", color: "bg-gray-100 text-gray-700" },
    VIEWER: { label: "Observateur", color: "bg-slate-100 text-slate-600" },
  } as const;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={availableMembers.length === 0}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Ajouter membre
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Ajouter un membre</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Membre <span className="text-red-500">*</span></Label>
                <Select value={form.userId} onValueChange={(v) => setForm({ ...form, userId: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  <SelectContent>
                    {availableMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Rôle</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OWNER">Propriétaire</SelectItem>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                    <SelectItem value="MEMBER">Membre</SelectItem>
                    <SelectItem value="VIEWER">Observateur</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Taux horaire (XAF/h)</Label>
                <Input
                  type="number"
                  value={form.hourlyRate}
                  onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
                  placeholder="Ex: 15000"
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">Utilisé pour calculer le coût des entrées de temps</p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAdd} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Ajouter
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {members.map((m) => {
          const roleCfg = ROLE_CONFIG[m.role as keyof typeof ROLE_CONFIG] ?? ROLE_CONFIG.MEMBER;
          return (
            <Card key={m.userId}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center font-medium text-sm">
                  {m.user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{m.user.name}</p>
                  <p className="text-xs text-muted-foreground">{m.user.email}</p>
                </div>
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", roleCfg.color)}>
                  {roleCfg.label}
                </span>
                {m.hourlyRate && (
                  <span className="text-xs text-muted-foreground">
                    {Number(m.hourlyRate).toLocaleString("fr-FR")} XAF/h
                  </span>
                )}
                {m.role !== "OWNER" && m.userId !== currentUserId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                    onClick={() => handleRemove(m.userId)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
