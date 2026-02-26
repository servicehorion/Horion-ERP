import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, BarChart3, Calendar, CheckCircle2, Clock,
  DollarSign, Flag, Layers, Plus, Target, Users, Zap,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { getProject } from "@/lib/actions/project.actions";
import { getTeamMembers } from "@/lib/actions/task.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TaskStatusBadge, PriorityBadge } from "@/components/shared/status-badge";
import { ProjectDetailClient } from "@/components/projects/project-detail-client";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: { params: { id: string } }) {
  return { title: "Projet | Horion ERP" };
}

const STATUS_CONFIG = {
  PLANNING: { label: "Planification", color: "bg-slate-100 text-slate-700" },
  ACTIVE: { label: "Actif", color: "bg-green-100 text-green-700" },
  ON_HOLD: { label: "En pause", color: "bg-amber-100 text-amber-700" },
  COMPLETED: { label: "Terminé", color: "bg-blue-100 text-blue-700" },
  CANCELLED: { label: "Annulé", color: "bg-red-100 text-red-700" },
  ARCHIVED: { label: "Archivé", color: "bg-gray-100 text-gray-500" },
} as const;

export default async function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const [projectResult, membersResult] = await Promise.all([
    getProject(params.id),
    getTeamMembers(),
  ]);

  if (projectResult.error || !projectResult.data) notFound();

  const project = projectResult.data;
  const teamMembers = membersResult.data || [];
  const cfg = STATUS_CONFIG[project.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.PLANNING;

  // Compute stats
  const tasks = project.tasks || [];
  const completedTasks = tasks.filter((t: any) => t.status === "COMPLETED").length;
  const totalTasks = tasks.length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const budgets = project.budgets || [];
  const totalBudget = budgets.reduce((sum: number, b: any) => sum + Number(b.planned), 0);
  const totalActual = budgets.reduce((sum: number, b: any) => sum + Number(b.actual), 0);
  const budgetPct = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;

  const activeSprint = project.sprints?.find((s: any) => s.status === "ACTIVE");
  const daysLeft = project.endDate
    ? Math.ceil((new Date(project.endDate).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/projects">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Projets
          </Button>
        </Link>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: project.color }}
          />
          <h1 className="text-xl font-bold truncate">
            {project.icon && <span className="mr-1">{project.icon}</span>}
            {project.name}
          </h1>
          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", cfg.color)}>
            {cfg.label}
          </span>
        </div>
        <Link href={`/projects/${params.id}/analytics`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </Button>
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 bg-muted/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Progression</span>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xl font-bold">{progress}%</p>
            <Progress value={progress} className="h-1.5 mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {completedTasks}/{totalTasks} tâches
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 bg-muted/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Budget</span>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            {totalBudget > 0 ? (
              <>
                <p className={cn("text-xl font-bold", budgetPct > 100 ? "text-red-600" : "")}>
                  {budgetPct}%
                </p>
                <Progress
                  value={Math.min(100, budgetPct)}
                  className={cn("h-1.5 mt-2", budgetPct > 100 && "[&>div]:bg-red-500")}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {totalActual.toLocaleString("fr-FR")} / {totalBudget.toLocaleString("fr-FR")} XAF
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">Non défini</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 bg-muted/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Équipe</span>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xl font-bold">{project.members?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">membres</p>
          </CardContent>
        </Card>

        <Card className="border-0 bg-muted/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Échéance</span>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            {daysLeft !== null ? (
              <>
                <p className={cn(
                  "text-xl font-bold",
                  daysLeft < 0 ? "text-red-600" : daysLeft <= 7 ? "text-amber-600" : ""
                )}>
                  {daysLeft < 0 ? `${Math.abs(daysLeft)}j` : `${daysLeft}j`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {daysLeft < 0 ? "de retard" : "restants"}
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">Non définie</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Interactive detail client */}
      <ProjectDetailClient
        project={project as any}
        teamMembers={teamMembers}
        currentUserId={session.user.id || ""}
      />
    </div>
  );
}
