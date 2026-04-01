import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3, Calendar, CheckCircle2, Clock, FolderOpen,
  Layers, Plus, TrendingUp, Users,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { getProjects } from "@/lib/actions/project.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ProjectCreateDialog } from "@/components/projects/project-create-dialog";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Projets | Horion ERP",
};

const STATUS_CONFIG = {
  PLANNING: { label: "Planification", color: "bg-slate-100 text-slate-700" },
  ACTIVE: { label: "Actif", color: "bg-green-100 text-green-700" },
  ON_HOLD: { label: "En pause", color: "bg-amber-100 text-amber-700" },
  COMPLETED: { label: "Terminé", color: "bg-blue-100 text-blue-700" },
  CANCELLED: { label: "Annulé", color: "bg-red-100 text-red-700" },
  ARCHIVED: { label: "Archivé", color: "bg-gray-100 text-gray-500" },
} as const;

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect("/login");

  const result = await getProjects({ limit: 100 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projects = (result.data || []) as any[];

  const stats = {
    total: projects.length,
    active: projects.filter((p) => p.status === "ACTIVE").length,
    completed: projects.filter((p) => p.status === "COMPLETED").length,
    planning: projects.filter((p) => p.status === "PLANNING").length,
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projets</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Planifiez, suivez et livrez vos projets
          </p>
        </div>
        <ProjectCreateDialog />
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 bg-muted/40">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FolderOpen className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-muted/40">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-green-600">{stats.active}</p>
              <p className="text-xs text-muted-foreground">Actifs</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-muted/40">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-500/10">
              <Clock className="h-4 w-4 text-slate-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{stats.planning}</p>
              <p className="text-xs text-muted-foreground">En planification</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-muted/40">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-blue-600">{stats.completed}</p>
              <p className="text-xs text-muted-foreground">Terminés</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Project grid */}
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FolderOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold mb-1">Aucun projet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Créez votre premier projet pour commencer
          </p>
          <ProjectCreateDialog />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((project) => {
            const cfg = STATUS_CONFIG[project.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.PLANNING;
            const taskCount = project._count?.tasks ?? 0;
            const activeSprint = project.sprints?.[0];
            const memberCount = project.members?.length ?? 0;
            const nextMilestone = project.milestones?.[0];
            // Compute days left
            const daysLeft = project.endDate
              ? Math.ceil((new Date(project.endDate).getTime() - Date.now()) / 86400000)
              : null;

            return (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: project.color }}
                        />
                        <div className="min-w-0">
                          <CardTitle className="text-base line-clamp-1 group-hover:text-primary transition-colors">
                            {project.icon && <span className="mr-1">{project.icon}</span>}
                            {project.name}
                          </CardTitle>
                          {project.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {project.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap", cfg.color)}>
                        {cfg.label}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Stats row */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Layers className="h-3 w-3" /> {taskCount} tâches
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {memberCount} membres
                      </span>
                      {activeSprint && (
                        <span className="flex items-center gap-1 text-green-600">
                          <BarChart3 className="h-3 w-3" /> Sprint actif
                        </span>
                      )}
                    </div>

                    {/* Next milestone */}
                    {nextMilestone && (
                      <div className="flex items-center gap-2 text-xs">
                        <CheckCircle2 className="h-3 w-3 text-amber-500 flex-shrink-0" />
                        <span className="text-muted-foreground truncate">{nextMilestone.name}</span>
                        {nextMilestone.dueDate && (
                          <span className="text-muted-foreground ml-auto whitespace-nowrap">
                            {new Date(nextMilestone.dueDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Deadline */}
                    {daysLeft !== null && (
                      <div className="flex items-center gap-2 text-xs">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span className={cn(
                          daysLeft < 0 ? "text-red-600 font-medium" :
                          daysLeft <= 7 ? "text-amber-600 font-medium" :
                          "text-muted-foreground"
                        )}>
                          {daysLeft < 0
                            ? `${Math.abs(daysLeft)}j de retard`
                            : daysLeft === 0
                            ? "Échéance aujourd'hui"
                            : `${daysLeft}j restants`}
                        </span>
                        {project.endDate && (
                          <span className="ml-auto text-muted-foreground">
                            {new Date(project.endDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Member avatars */}
                    {project.members && project.members.length > 0 && (
                      <div className="flex -space-x-1.5 pt-1">
                        {project.members.slice(0, 5).map((m: any) => (
                          <div
                            key={m.userId}
                            className="w-6 h-6 rounded-full bg-primary/20 border border-background flex items-center justify-center text-[9px] font-medium"
                            title={m.user?.name}
                          >
                            {m.user?.name?.charAt(0).toUpperCase()}
                          </div>
                        ))}
                        {project.members.length > 5 && (
                          <div className="w-6 h-6 rounded-full bg-muted border border-background flex items-center justify-center text-[9px] text-muted-foreground">
                            +{project.members.length - 5}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
