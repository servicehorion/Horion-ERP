"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, ClipboardList, Plus, Rocket, Sparkles, Target, Zap } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createDecisionTemplate,
  createStrategicDecision,
  deleteDecisionTemplate,
  evaluateDecisionRules,
  executeStrategicDecision,
} from "@/lib/actions/pilotage.actions";

type DecisionAction = {
  id: string;
  type: string;
  status: string;
  payload: unknown;
  error?: string | null;
  executedAt?: string | Date | null;
  createdAt: string | Date;
};

type ActivationRule = {
  metric: string;
  operator: "LT" | "LTE" | "GT" | "GTE";
  value: number;
  severity?: "red" | "orange";
  note?: string;
};

type ExecutionTask = {
  title: string;
  description?: string;
  module?: string;
  priority?: string;
  slaHours?: number;
};

type StrategicDecision = {
  id: string;
  title: string;
  description?: string | null;
  objective?: string | null;
  targetMetric?: string | null;
  targetValue?: number | null;
  targetUnit?: string | null;
  riskLevel?: string | null;
  priority: string;
  status: string;
  horizon: string;
  impactAreas: unknown;
  executionPlan: unknown;
  activationRules?: ActivationRule[] | null;
  executedAt?: string | Date | null;
  completedAt?: string | Date | null;
  createdAt: string | Date;
  owner?: { id: string; name: string } | null;
  actions: DecisionAction[];
};

type DecisionTemplate = {
  id: string;
  name: string;
  description?: string | null;
  impactAreas: string[];
  defaultPriority: string;
  defaultHorizon: string;
  projectName?: string | null;
  projectDescription?: string | null;
  tasks: unknown;
};

type SuggestedPriority = {
  title: string;
  reason: string;
  href: string;
  severity: "high" | "medium" | "low";
};

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const HORIZONS = ["MONTH", "QUARTER", "YEAR"];
const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const METRICS = [
  { value: "marginPercent", label: "Margin %" },
  { value: "cashPosition", label: "Cash position" },
  { value: "overdueRate", label: "Overdue rate" },
  { value: "crmConversionRate", label: "CRM conversion" },
  { value: "pipelineValue", label: "Pipeline value" },
  { value: "sourcingSlaBreachRate", label: "Sourcing SLA breach" },
  { value: "logisticsDelayRate", label: "Logistics delay" },
  { value: "qcFailRate", label: "QC fail rate" },
  { value: "qcPassRate", label: "QC pass rate" },
];
const OPERATORS: ActivationRule["operator"][] = ["LT", "LTE", "GT", "GTE"];

const statusTheme: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  ACTIVE: "bg-blue-100 text-blue-800",
  EXECUTING: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-zinc-100 text-zinc-700",
};

const priorityTheme: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-700",
  MEDIUM: "bg-blue-100 text-blue-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800",
};

function parseTaskLines(value: string): ExecutionTask[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((part) => part.trim());
      return {
        module: parts[0] || "orders",
        title: parts[1] || parts[0] || "Task",
        priority: parts[2] || "NORMAL",
        slaHours: parts[3] ? Number(parts[3]) : undefined,
      };
    });
}

function formatExecutionTasks(tasks: ExecutionTask[]) {
  return tasks
    .map((task) => {
      const parts = [task.module || "orders", task.title, task.priority || "NORMAL"];
      if (task.slaHours) parts.push(String(task.slaHours));
      return parts.join(" | ");
    })
    .join("\n");
}

function groupDecisions(decisions: StrategicDecision[]) {
  return {
    pending: decisions.filter((decision) => decision.status === "DRAFT"),
    active: decisions.filter((decision) => ["ACTIVE", "EXECUTING"].includes(decision.status)),
    completed: decisions.filter((decision) => decision.status === "COMPLETED"),
  };
}

export function DecisionEngine({
  decisions: initialDecisions,
  templates: initialTemplates,
  suggestions = [],
}: {
  decisions: any[];
  templates: any[];
  suggestions?: SuggestedPriority[];
}) {
  const router = useRouter();
  const [decisions, setDecisions] = useState<StrategicDecision[]>(initialDecisions as StrategicDecision[]);
  const [templates, setTemplates] = useState<DecisionTemplate[]>(initialTemplates as DecisionTemplate[]);
  const [isOpen, setIsOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [objective, setObjective] = useState("");
  const [targetMetric, setTargetMetric] = useState("marginPercent");
  const [targetValue, setTargetValue] = useState("");
  const [targetUnit, setTargetUnit] = useState("%");
  const [riskLevel, setRiskLevel] = useState("MEDIUM");
  const [priority, setPriority] = useState("MEDIUM");
  const [horizon, setHorizon] = useState("QUARTER");
  const [impactAreas, setImpactAreas] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [tasksText, setTasksText] = useState("");
  const [templateId, setTemplateId] = useState("none");
  const [templateName, setTemplateName] = useState("");
  const [activationRules, setActivationRules] = useState<ActivationRule[]>([
    { metric: "marginPercent", operator: "LT", value: 20, severity: "red", note: "" },
  ]);

  const grouped = groupDecisions(decisions);

  function resetForm() {
    setTitle("");
    setDescription("");
    setObjective("");
    setTargetMetric("marginPercent");
    setTargetValue("");
    setTargetUnit("%");
    setRiskLevel("MEDIUM");
    setPriority("MEDIUM");
    setHorizon("QUARTER");
    setImpactAreas("");
    setProjectName("");
    setProjectDescription("");
    setTasksText("");
    setTemplateId("none");
    setTemplateName("");
    setActivationRules([{ metric: "marginPercent", operator: "LT", value: 20, severity: "red", note: "" }]);
  }

  function applyTemplate(id: string) {
    setTemplateId(id);
    if (id === "none") return;
    const template = templates.find((item) => item.id === id);
    if (!template) return;
    setPriority(template.defaultPriority || "MEDIUM");
    setHorizon(template.defaultHorizon || "QUARTER");
    setImpactAreas((template.impactAreas || []).join(", "));
    setProjectName(template.projectName || "");
    setProjectDescription(template.projectDescription || "");
    const templateTasks = Array.isArray(template.tasks) ? (template.tasks as ExecutionTask[]) : [];
    setTasksText(formatExecutionTasks(templateTasks));
  }

  function updateRule(index: number, patch: Partial<ActivationRule>) {
    setActivationRules((current) => current.map((rule, idx) => (idx === index ? { ...rule, ...patch } : rule)));
  }

  function addRule() {
    setActivationRules((current) => [
      ...current,
      { metric: "cashPosition", operator: "LT", value: 0, severity: "red", note: "" },
    ]);
  }

  function removeRule(index: number) {
    setActivationRules((current) => current.filter((_, idx) => idx !== index));
  }

  function handleCreateDecision() {
    if (!title.trim()) {
      toast.error("Titre requis");
      return;
    }

    const executionTasks = parseTaskLines(tasksText);
    const mappedImpactAreas = impactAreas
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const normalizedRules = activationRules
      .filter((rule) => rule.metric && Number.isFinite(rule.value))
      .map((rule) => ({ ...rule, note: rule.note?.trim() || undefined }));

    startTransition(async () => {
      const result = await createStrategicDecision({
        title,
        description: description || undefined,
        objective: objective || undefined,
        targetMetric: targetMetric || undefined,
        targetValue: targetValue ? Number(targetValue) : undefined,
        targetUnit: targetUnit || undefined,
        riskLevel: riskLevel as any,
        priority: priority as any,
        horizon: horizon as any,
        impactAreas: mappedImpactAreas,
        executionTemplateId: templateId === "none" ? null : templateId,
        activationRules: normalizedRules,
        executionPlan: {
          project: projectName ? { name: projectName, description: projectDescription || undefined } : undefined,
          tasks: executionTasks,
        },
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setDecisions((current) => [result.data as unknown as StrategicDecision, ...current]);
      setIsOpen(false);
      resetForm();
      router.refresh();
      toast.success("Decision created");
    });
  }

  function handleSaveTemplate() {
    if (!templateName.trim()) {
      toast.error("Nom du template requis");
      return;
    }

    const mappedImpactAreas = impactAreas
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    startTransition(async () => {
      const result = await createDecisionTemplate({
        name: templateName,
        description: description || undefined,
        impactAreas: mappedImpactAreas,
        defaultPriority: priority as any,
        defaultHorizon: horizon as any,
        projectName: projectName || undefined,
        projectDescription: projectDescription || undefined,
        tasks: parseTaskLines(tasksText),
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setTemplates((current) => [result.data as DecisionTemplate, ...current]);
      setTemplateName("");
      router.refresh();
      toast.success("Template saved");
    });
  }

  function handleDeleteTemplate(id: string) {
    startTransition(async () => {
      const result = await deleteDecisionTemplate(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      setTemplates((current) => current.filter((item) => item.id !== id));
      if (templateId === id) setTemplateId("none");
      router.refresh();
      toast.success("Template removed");
    });
  }

  function handleExecuteDecision(decisionId: string) {
    startTransition(async () => {
      const result = await executeStrategicDecision(decisionId);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      setDecisions((current) =>
        current.map((decision) =>
          decision.id === decisionId
            ? { ...decision, status: "COMPLETED", completedAt: new Date().toISOString() }
            : decision
        )
      );
      router.refresh();
      toast.success("Decision executed");
    });
  }

  function handleEvaluateRules() {
    startTransition(async () => {
      const result = await evaluateDecisionRules();
      if (result.error) {
        toast.error(result.error);
        return;
      }

      router.refresh();
      toast.success(`${result.data?.activated || 0} decision(s) activated`);
    });
  }

  return (
    <div className="space-y-6">
      {suggestions.length > 0 ? (
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-blue-600" />
              Suggested priorities from Strategic Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {suggestions.slice(0, 3).map((suggestion, index) => (
              <Link
                key={`${suggestion.title}-${index}`}
                href={suggestion.href}
                className="rounded-xl border bg-white/90 p-4 transition hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium">{suggestion.title}</div>
                  <Badge variant="outline">{suggestion.severity}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{suggestion.reason}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {templates.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Execution templates</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {templates.map((template) => (
              <div key={template.id} className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm">
                <button type="button" className="font-medium" onClick={() => applyTemplate(template.id)}>
                  {template.name}
                </button>
                <button
                  type="button"
                  className="text-xs text-red-500"
                  onClick={() => handleDeleteTemplate(template.id)}
                >
                  Remove
                </button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Strategic Decision Engine</h1>
          <p className="text-muted-foreground">
            Create decisions, bind triggers, and convert strategy into execution.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleEvaluateRules} disabled={pending}>
            <Zap className="mr-2 h-4 w-4" />
            Evaluate rules
          </Button>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New decision
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
              <DialogHeader>
                <DialogTitle>Decision Builder</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label>Titre</Label>
                  <Input value={title} onChange={(event) => setTitle(event.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label>Description</Label>
                  <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
                </div>
                <div className="md:col-span-2">
                  <Label>Strategic objective</Label>
                  <Textarea value={objective} onChange={(event) => setObjective(event.target.value)} rows={2} />
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((item) => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Horizon</Label>
                  <Select value={horizon} onValueChange={setHorizon}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {HORIZONS.map((item) => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Target metric</Label>
                  <Select value={targetMetric} onValueChange={setTargetMetric}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {METRICS.map((metric) => (
                        <SelectItem key={metric.value} value={metric.value}>{metric.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-[1fr_120px] gap-2">
                  <div>
                    <Label>Target value</Label>
                    <Input value={targetValue} onChange={(event) => setTargetValue(event.target.value)} />
                  </div>
                  <div>
                    <Label>Unit</Label>
                    <Input value={targetUnit} onChange={(event) => setTargetUnit(event.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Risk level</Label>
                  <Select value={riskLevel} onValueChange={setRiskLevel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RISK_LEVELS.map((item) => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Impact areas</Label>
                  <Input
                    value={impactAreas}
                    onChange={(event) => setImpactAreas(event.target.value)}
                    placeholder="crm, sourcing, logistics, finance, qc"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Decision template</Label>
                  <Select value={templateId} onValueChange={applyTemplate}>
                    <SelectTrigger><SelectValue placeholder="No template" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No template</SelectItem>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2 rounded-xl border p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">Activation rules</div>
                    <Button type="button" variant="outline" size="sm" onClick={addRule}>
                      Add rule
                    </Button>
                  </div>
                  <div className="mt-3 space-y-3">
                    {activationRules.map((rule, index) => (
                      <div key={`${rule.metric}-${index}`} className="grid gap-2 md:grid-cols-[1.1fr_100px_110px_120px_auto]">
                        <Select value={rule.metric} onValueChange={(value) => updateRule(index, { metric: value })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {METRICS.map((metric) => (
                              <SelectItem key={metric.value} value={metric.value}>{metric.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={rule.operator}
                          onValueChange={(value) => updateRule(index, { operator: value as ActivationRule["operator"] })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {OPERATORS.map((operator) => (
                              <SelectItem key={operator} value={operator}>{operator}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={String(rule.value)}
                          onChange={(event) => updateRule(index, { value: Number(event.target.value) || 0 })}
                          placeholder="20"
                        />
                        <Select
                          value={rule.severity || "orange"}
                          onValueChange={(value) => updateRule(index, { severity: value as "red" | "orange" })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="orange">Orange</SelectItem>
                            <SelectItem value="red">Red</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="ghost" onClick={() => removeRule(index)}>
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-2 rounded-xl border p-4">
                  <div className="font-medium">Execution plan</div>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <Label>Project name</Label>
                      <Input value={projectName} onChange={(event) => setProjectName(event.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Project description</Label>
                      <Textarea
                        value={projectDescription}
                        onChange={(event) => setProjectDescription(event.target.value)}
                        rows={2}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Tasks distribution</Label>
                      <Textarea
                        value={tasksText}
                        onChange={(event) => setTasksText(event.target.value)}
                        rows={7}
                        placeholder="qc | Build partner shortlist | HIGH | 48"
                      />
                      <p className="mt-2 text-xs text-muted-foreground">
                        Format: module | title | priority | slaHours
                      </p>
                    </div>
                    <div className="md:col-span-2 grid gap-2 md:grid-cols-[1fr_auto]">
                      <div>
                        <Label>Save current plan as template</Label>
                        <Input value={templateName} onChange={(event) => setTemplateName(event.target.value)} />
                      </div>
                      <div className="flex items-end">
                        <Button variant="outline" type="button" onClick={handleSaveTemplate} disabled={pending}>
                          Save template
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <Button onClick={handleCreateDecision} disabled={pending || !title.trim()} className="mt-4 w-full">
                {pending ? "Saving..." : "Create decision"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <DecisionColumn title="Pending" accent="slate" decisions={grouped.pending} onExecute={handleExecuteDecision} />
        <DecisionColumn title="Active" accent="blue" decisions={grouped.active} onExecute={handleExecuteDecision} />
        <DecisionColumn title="Completed" accent="green" decisions={grouped.completed} onExecute={handleExecuteDecision} />
      </div>
    </div>
  );
}

function DecisionColumn({
  title,
  decisions,
  accent,
  onExecute,
}: {
  title: string;
  decisions: StrategicDecision[];
  accent: "slate" | "blue" | "green";
  onExecute: (decisionId: string) => void;
}) {
  const accentClass = {
    slate: "border-slate-200 bg-slate-50/70",
    blue: "border-blue-200 bg-blue-50/70",
    green: "border-green-200 bg-green-50/70",
  }[accent];

  return (
    <Card className={accentClass}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span>{title}</span>
          <Badge variant="outline">{decisions.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {decisions.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-white/70 p-6 text-center text-sm text-muted-foreground">
            No decisions
          </div>
        ) : (
          decisions.map((decision) => <DecisionCard key={decision.id} decision={decision} onExecute={onExecute} />)
        )}
      </CardContent>
    </Card>
  );
}

function DecisionCard({
  decision,
  onExecute,
}: {
  decision: StrategicDecision;
  onExecute: (decisionId: string) => void;
}) {
  const executionPlan = (decision.executionPlan || {}) as {
    project?: { name?: string; description?: string };
    tasks?: ExecutionTask[];
  };
  const executionTasks = executionPlan.tasks || [];
  const groupedModules = executionTasks.reduce<Record<string, number>>((accumulator, task) => {
    const moduleName = (task.module || "orders").toLowerCase();
    accumulator[moduleName] = (accumulator[moduleName] || 0) + 1;
    return accumulator;
  }, {});
  const projectAction = decision.actions.find((action) => action.type === "CREATE_PROJECT");
  const taskAction = decision.actions.find((action) => action.type === "CREATE_TASKS");
  const projectPayload = (projectAction?.payload || null) as { projectId?: string } | null;
  const taskPayload = (taskAction?.payload || null) as { taskIds?: string[] } | null;
  const projectId =
    projectPayload && typeof projectPayload.projectId === "string"
      ? projectPayload.projectId
      : null;
  const taskIds =
    taskPayload && Array.isArray(taskPayload.taskIds)
      ? taskPayload.taskIds
      : [];
  const targetProgress =
    decision.targetValue && decision.targetValue > 0
      ? Math.min(100, Math.max(0, Math.round((executionTasks.length / decision.targetValue) * 100)))
      : null;

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{decision.title}</div>
          {decision.objective ? <p className="mt-1 text-sm text-muted-foreground">{decision.objective}</p> : null}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusTheme[decision.status] || statusTheme.DRAFT}`}>
            {decision.status}
          </span>
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${priorityTheme[decision.priority] || priorityTheme.MEDIUM}`}>
            {decision.priority}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <Badge variant="outline">{decision.horizon}</Badge>
        {decision.riskLevel ? <Badge variant="outline">Risk {decision.riskLevel}</Badge> : null}
        {Array.isArray(decision.impactAreas)
          ? decision.impactAreas.map((area) => (
              <Badge key={area} variant="secondary" className="capitalize">
                {area}
              </Badge>
            ))
          : null}
      </div>

      {decision.targetMetric ? (
        <div className="mt-3 rounded-xl border bg-slate-50 p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Target</span>
            <span className="font-medium">
              {decision.targetMetric} {decision.targetValue ?? "-"} {decision.targetUnit || ""}
            </span>
          </div>
          {targetProgress !== null ? <Progress value={targetProgress} className="mt-2 h-1.5" /> : null}
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ClipboardList className="h-4 w-4" />
            Execution plan
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            {executionPlan.project?.name ? <div>Project: {executionPlan.project.name}</div> : <div>No project bound</div>}
            <div className="mt-1">Tasks: {executionTasks.length}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(groupedModules).map(([moduleName, count]) => (
                <Badge key={moduleName} variant="outline" className="capitalize">
                  {moduleName} {count}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-xl border p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Target className="h-4 w-4" />
            Activation rules
          </div>
          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
            {(decision.activationRules || []).length === 0 ? (
              <div>No activation rules</div>
            ) : (
              decision.activationRules?.map((rule, index) => (
                <div key={`${rule.metric}-${index}`} className="flex items-center justify-between gap-2">
                  <span>{rule.metric}</span>
                  <span>{rule.operator} {rule.value}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {decision.actions.length > 0 ? (
        <div className="mt-3 rounded-xl border p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="h-4 w-4" />
            Action log
          </div>
          <div className="space-y-1 text-sm text-muted-foreground">
            {decision.actions.slice(0, 4).map((action) => (
              <div key={action.id} className="flex items-center justify-between">
                <span>{action.type}</span>
                <span>{action.status}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {decision.status !== "COMPLETED" ? (
          <Button size="sm" onClick={() => onExecute(decision.id)}>
            <Rocket className="mr-2 h-4 w-4" />
            Execute
          </Button>
        ) : null}
        {projectId ? (
          <Button size="sm" variant="outline" asChild>
            <Link href={`/projects/${projectId}`}>Open project</Link>
          </Button>
        ) : null}
        {taskIds.length > 0 ? (
          <Button size="sm" variant="outline" asChild>
            <Link href={projectId ? `/tasks?project=${projectId}` : "/tasks"}>Open tasks</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
