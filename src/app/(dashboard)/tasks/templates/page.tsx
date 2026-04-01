import Link from "next/link";
import {
  ArrowLeft, Bot, CheckSquare, Clock, Copy, FileText,
  Layers, Plus, RefreshCw, Shield, Tag, Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PriorityBadge } from "@/components/shared/status-badge";
import { getTaskTemplates } from "@/lib/actions/task.actions";
import { TemplateActions } from "@/components/tasks/template-actions";
import { cn } from "@/lib/utils";

export const metadata = { title: "Modèles de tâches | Horion ERP" };

// Module color map
const MODULE_COLORS: Record<string, string> = {
  sourcing: "bg-blue-100 text-blue-700 border-blue-200",
  orders: "bg-green-100 text-green-700 border-green-200",
  finance: "bg-amber-100 text-amber-700 border-amber-200",
  logistics: "bg-purple-100 text-purple-700 border-purple-200",
  crm: "bg-pink-100 text-pink-700 border-pink-200",
  catalog: "bg-orange-100 text-orange-700 border-orange-200",
  manual: "bg-gray-100 text-gray-700 border-gray-200",
};

const MODULE_LABELS: Record<string, string> = {
  sourcing: "Sourcing",
  orders: "Commandes",
  finance: "Finance",
  logistics: "Logistique",
  crm: "CRM",
  catalog: "Catalogue",
  manual: "Manuel",
};

interface PageProps {
  searchParams: Promise<{ module?: string }>;
}

export default async function TaskTemplatesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const activeModule = params.module;
  const result = await getTaskTemplates(activeModule);
  const templates = (result.data ?? []) as any[];

  // Group by module
  const byModule = templates.reduce((acc, t) => {
    if (!acc[t.module]) acc[t.module] = [];
    acc[t.module].push(t);
    return acc;
  }, {} as Record<string, any[]>);

  const modules = Object.keys(byModule).sort();

  // Stats
  const totalActive = templates.filter((t) => t.isActive).length;
  const withApproval = templates.filter((t) => t.requiresApproval).length;
  const automatable = templates.filter((t) => t.automationAllowed).length;
  const agentTemplates = templates.filter((t) => t.ownerType === "AI_AGENT").length;

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/tasks"><ArrowLeft className="h-4 w-4 mr-1" />Tâches</Link>
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Modèles de tâches</h1>
            <p className="text-sm text-muted-foreground">
              Créez et gérez des templates réutilisables pour standardiser vos workflows
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/tasks"><Layers className="mr-2 h-4 w-4" />Dashboard</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/tasks/board"><RefreshCw className="mr-2 h-4 w-4" />Kanban</Link>
          </Button>
          <TemplateActions mode="create" />
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Modèles actifs", value: totalActive, icon: FileText, color: "text-blue-600" },
          { label: "Avec approbation", value: withApproval, icon: Shield, color: "text-yellow-600" },
          { label: "Automatisables", value: automatable, icon: Zap, color: "text-green-600" },
          { label: "Agent IA", value: agentTemplates, icon: Bot, color: "text-purple-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-0 shadow-sm bg-muted/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground font-medium">{label}</span>
                <Icon className={cn("h-4 w-4", color)} />
              </div>
              <div className={cn("text-2xl font-bold", color)}>{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Module filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Filtrer :</span>
        <Link
          href="/tasks/templates"
          className={cn(
            "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border transition-colors",
            !activeModule
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background hover:bg-muted border-border text-muted-foreground"
          )}
        >
          Tous ({templates.length})
        </Link>
        {modules.map((mod) => (
          <Link
            key={mod}
            href={`/tasks/templates?module=${mod}`}
            className={cn(
              "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border transition-colors",
              activeModule === mod
                ? "bg-primary text-primary-foreground border-primary"
                : cn("bg-background hover:bg-muted", MODULE_COLORS[mod] ?? "border-border text-muted-foreground")
            )}
          >
            {MODULE_LABELS[mod] ?? mod} ({byModule[mod].length})
          </Link>
        ))}
      </div>

      {/* Templates grid */}
      {templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground">Aucun modèle de tâche</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Les modèles de tâches permettent de standardiser vos processus et d&apos;accélérer la création de tâches récurrentes.
            </p>
            <TemplateActions mode="create" className="mt-4" />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {(activeModule ? [activeModule] : modules).map((mod) => {
            const modTemplates = byModule[mod] ?? [];
            if (modTemplates.length === 0) return null;
            return (
              <div key={mod}>
                <div className="flex items-center gap-2 mb-3">
                  <Badge className={cn("text-xs", MODULE_COLORS[mod] ?? "")}>
                    {MODULE_LABELS[mod] ?? mod}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{modTemplates.length} modèle{modTemplates.length > 1 ? "s" : ""}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {modTemplates.map((template: any) => (
                    <TemplateCard key={template.id} template={template} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* How it works section */}
      <Card className="border-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-blue-700 dark:text-blue-400 flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Comment fonctionnent les modèles ?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <div className="font-semibold text-blue-800 dark:text-blue-300">1. Créer un modèle</div>
              <p className="text-muted-foreground text-xs">Définissez titre, description, module, SLA, sous-tâches et dépendances. Utilisez <code className="bg-muted px-1 rounded">{"{{variable}}"}</code> pour les champs dynamiques.</p>
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-blue-800 dark:text-blue-300">2. Instancier</div>
              <p className="text-muted-foreground text-xs">Cliquez sur &quot;Utiliser&quot; pour créer une tâche depuis le modèle. Les variables sont remplacées automatiquement et les sous-tâches créées.</p>
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-blue-800 dark:text-blue-300">3. Automatiser</div>
              <p className="text-muted-foreground text-xs">Activez la répétition (CRON) pour des tâches récurrentes. Les agents IA peuvent aussi utiliser les modèles via l&apos;API.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Template card ─────────────────────────────────────────────────────────────
function TemplateCard({ template }: { template: any }) {
  const subtaskDefs = Array.isArray(template.subtaskDefinitions)
    ? template.subtaskDefinitions
    : [];

  return (
    <Card className="hover:shadow-md transition-shadow group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-tight truncate">{template.name}</h3>
            {template.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{template.description}</p>
            )}
          </div>
          {!template.isActive && (
            <Badge variant="outline" className="text-xs shrink-0">Inactif</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Title template */}
        <div className="bg-muted/50 rounded-md p-2">
          <div className="text-xs text-muted-foreground mb-0.5">Titre généré :</div>
          <code className="text-xs font-mono text-foreground">{template.titleTemplate}</code>
        </div>

        {/* Properties */}
        <div className="flex flex-wrap gap-1.5">
          <PriorityBadge priority={template.defaultPriority} />
          {template.defaultSlaHours && (
            <Badge variant="outline" className="text-xs">
              <Clock className="mr-1 h-3 w-3" />{template.defaultSlaHours}h SLA
            </Badge>
          )}
          {template.requiresApproval && (
            <Badge variant="outline" className="text-xs text-yellow-600">
              <Shield className="mr-1 h-3 w-3" />Approbation
            </Badge>
          )}
          {template.automationAllowed && (
            <Badge variant="outline" className="text-xs text-green-600">
              <Zap className="mr-1 h-3 w-3" />Auto
            </Badge>
          )}
          {template.ownerType === "AI_AGENT" && (
            <Badge className="text-xs bg-purple-100 text-purple-700">
              <Bot className="mr-1 h-3 w-3" />Agent IA
            </Badge>
          )}
        </div>

        {/* Subtask count */}
        {subtaskDefs.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckSquare className="h-3.5 w-3.5" />
            <span>{subtaskDefs.length} sous-tâche{subtaskDefs.length > 1 ? "s" : ""} incluse{subtaskDefs.length > 1 ? "s" : ""}</span>
          </div>
        )}

        {/* Tags */}
        {template.defaultTags?.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <Tag className="h-3 w-3 text-muted-foreground shrink-0" />
            {template.defaultTags.map((tag: string) => (
              <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1 border-t">
          <TemplateActions mode="use" templateId={template.id} templateName={template.name} className="flex-1" />
          <TemplateActions mode="duplicate" templateId={template.id} />
        </div>
      </CardContent>
    </Card>
  );
}
