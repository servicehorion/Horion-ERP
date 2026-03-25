"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bot,
  Link2,
  ShieldCheck,
  Workflow,
} from "lucide-react";

import { KpiCard, KpiGrid } from "@/components/shared/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { createAgentHandoff, updateAgentConfiguration } from "@/lib/actions/agent.actions";

type Snapshot = {
  kpis: {
    configuredAgents: number;
    enabledAgents: number;
    registeredAgents: number;
    missingEscalationOwners: number;
    totalQueue: number;
    totalAutomatable: number;
    totalFailures: number;
    readinessScore: number;
  };
  users: { id: string; name: string; role: string }[];
  tools: { id: string; label: string; module: string; description: string; risk: string }[];
  agents: Array<{
    id: string;
    name: string;
    displayName: string;
    persona: string;
    summary: string;
    modules: string[];
    channels: string[];
    allowedModules: string[];
    allowedTools: string[];
    handoffTargets: string[];
    customerFacing: boolean;
    enabled: boolean;
    registered: boolean;
    autonomy: "assist" | "supervised" | "guarded_write";
    escalationSummary: string;
    escalationUserId?: string | null;
    notes?: string;
    metrics: {
      queue: number;
      automatable: number;
      failed: number;
      successRate: number;
    };
  }>;
};

const AUTONOMY_OPTIONS = [
  { value: "assist", label: "Assist", help: "L'agent suggere seulement." },
  { value: "supervised", label: "Supervised", help: "L'agent agit dans un cadre valide." },
  { value: "guarded_write", label: "Guarded write", help: "L'agent ecrit avec garde-fous et escalade." },
] as const;

export function AgentControlCenter({
  snapshot,
  canManage,
}: {
  snapshot: Snapshot;
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(
      snapshot.agents.map((agent) => [
        agent.id,
        {
          enabled: agent.enabled,
          autonomy: agent.autonomy,
          escalationUserId: agent.escalationUserId || "none",
          channels: agent.channels,
          allowedModules: agent.allowedModules,
          allowedTools: agent.allowedTools,
          notes: agent.notes || "",
        },
      ])
    ) as Record<
      string,
      {
        enabled: boolean;
        autonomy: "assist" | "supervised" | "guarded_write";
        escalationUserId: string;
        channels: string[];
        allowedModules: string[];
        allowedTools: string[];
        notes: string;
      }
    >
  );
  const [handoff, setHandoff] = useState({
    sourceAgentId: snapshot.agents[0]?.id || "customer_service",
    targetAgentId: snapshot.agents[1]?.id || "sourcing",
    title: "",
    summary: "",
    module: "",
    entityType: "",
    entityId: "",
  });

  const handleToggle = (
    agentId: string,
    key: "channels" | "allowedModules" | "allowedTools",
    value: string
  ) => {
    setDrafts((prev) => {
      const current = prev[agentId];
      const nextValues = current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value];
      return {
        ...prev,
        [agentId]: {
          ...current,
          [key]: nextValues,
        },
      };
    });
  };

  const saveAgent = (agentId: string) => {
    const draft = drafts[agentId];
    startTransition(async () => {
      const res = await updateAgentConfiguration({
        agentId: agentId as any,
        enabled: draft.enabled,
        autonomy: draft.autonomy,
        escalationUserId: draft.escalationUserId === "none" ? null : draft.escalationUserId,
        channels: draft.channels as any,
        allowedModules: draft.allowedModules as any,
        allowedTools: draft.allowedTools,
        notes: draft.notes,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Configuration agent mise a jour");
    });
  };

  const submitHandoff = () => {
    if (!handoff.title.trim()) {
      toast.error("Titre requis");
      return;
    }

    startTransition(async () => {
      const res = await createAgentHandoff({
        sourceAgentId: handoff.sourceAgentId as any,
        targetAgentId: handoff.targetAgentId as any,
        title: handoff.title.trim(),
        summary: handoff.summary.trim() || undefined,
        description: handoff.summary.trim() || undefined,
        module: handoff.module.trim() || undefined,
        entityType: handoff.entityType.trim() || undefined,
        entityId: handoff.entityId.trim() || undefined,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Handoff cree");
      setHandoff((prev) => ({ ...prev, title: "", summary: "", entityType: "", entityId: "" }));
    });
  };

  return (
    <div className="space-y-6">
      <KpiGrid cols={5}>
        <KpiCard
          label="Readiness"
          value={`${snapshot.kpis.readinessScore}%`}
          sub="cap pour accueillir les agents"
          icon={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}
          variant={snapshot.kpis.readinessScore >= 80 ? "success" : snapshot.kpis.readinessScore >= 60 ? "warning" : "danger"}
        />
        <KpiCard
          label="Agents actifs"
          value={`${snapshot.kpis.enabledAgents}/${snapshot.kpis.configuredAgents}`}
          sub="definitions activables"
          icon={<Bot className="h-4 w-4 text-muted-foreground" />}
        />
        <KpiCard
          label="Agents enregistres"
          value={snapshot.kpis.registeredAgents}
          sub="avec secret runtime configure"
          icon={<Link2 className="h-4 w-4 text-muted-foreground" />}
          variant={snapshot.kpis.registeredAgents === snapshot.kpis.enabledAgents ? "success" : "warning"}
        />
        <KpiCard
          label="Queue"
          value={snapshot.kpis.totalQueue}
          sub={`${snapshot.kpis.totalAutomatable} taches automatable`}
          icon={<Workflow className="h-4 w-4 text-muted-foreground" />}
        />
        <KpiCard
          label="Escalades manquantes"
          value={snapshot.kpis.missingEscalationOwners}
          sub={`${snapshot.kpis.totalFailures} executions en echec cumulees`}
          icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
          variant={snapshot.kpis.missingEscalationOwners > 0 ? "danger" : "default"}
        />
      </KpiGrid>

      <Card className="border-0 bg-muted/30">
        <CardContent className="grid gap-4 pt-6 md:grid-cols-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Runtime endpoints</p>
            <p className="text-sm font-medium">`/api/agent/tasks`, `/api/agent/catalog`, `/api/agent/context`</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Headers requis</p>
            <p className="text-sm font-medium">`x-agent-id`, `x-agent-secret` ou `Authorization: Bearer ...`</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Mode conseille</p>
            <p className="text-sm font-medium">Agents supervises avec handoff via Tasks OS</p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="agents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="handoffs">Handoffs</TabsTrigger>
          <TabsTrigger value="tools">Tool Catalog</TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            {snapshot.agents.map((agent) => {
              const draft = drafts[agent.id];
              return (
                <Card key={agent.id} className="border-0 bg-muted/30">
                  <CardHeader className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg">{agent.displayName}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {agent.persona} - {agent.summary}
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Badge variant={agent.registered ? "default" : "secondary"}>
                          {agent.registered ? "Runtime OK" : "Secret absent"}
                        </Badge>
                        <Badge variant={agent.customerFacing ? "default" : "outline"}>
                          {agent.customerFacing ? "Client-facing" : "Back-office"}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-4">
                      <Metric label="Queue" value={agent.metrics.queue} />
                      <Metric label="Auto" value={agent.metrics.automatable} />
                      <Metric label="Echecs" value={agent.metrics.failed} />
                      <Metric label="Success" value={`${agent.metrics.successRate}%`} />
                    </div>
                    <Progress value={agent.metrics.successRate} />
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Activation</Label>
                        <div className="flex items-center justify-between rounded-lg border bg-background/80 p-3">
                          <div>
                            <p className="text-sm font-medium">Activer cet agent</p>
                            <p className="text-xs text-muted-foreground">
                              Desactive = aucun handoff ni execution.
                            </p>
                          </div>
                          <Switch
                            checked={draft.enabled}
                            disabled={!canManage || pending}
                            onCheckedChange={(checked) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [agent.id]: { ...prev[agent.id], enabled: checked },
                              }))
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Autonomie</Label>
                        <Select
                          value={draft.autonomy}
                          disabled={!canManage || pending}
                          onValueChange={(value) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [agent.id]: {
                                ...prev[agent.id],
                                autonomy: value as "assist" | "supervised" | "guarded_write",
                              },
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {AUTONOMY_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {AUTONOMY_OPTIONS.find((option) => option.value === draft.autonomy)?.help}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Owner d'escalade</Label>
                      <Select
                        value={draft.escalationUserId}
                        disabled={!canManage || pending}
                        onValueChange={(value) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [agent.id]: { ...prev[agent.id], escalationUserId: value },
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choisir un owner" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Aucun</SelectItem>
                          {snapshot.users.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name} - {user.role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">{agent.escalationSummary}</p>
                    </div>

                    <OptionMatrix
                      title="Canaux"
                      description="Ou l'agent peut interagir."
                      items={agent.modules}
                      selected={draft.channels}
                      disabled={!canManage || pending}
                      onToggle={(value) => handleToggle(agent.id, "channels", value)}
                    />

                    <OptionMatrix
                      title="Modules autorises"
                      description="OS dans lesquels l'agent peut operer."
                      items={agent.modules}
                      selected={draft.allowedModules}
                      disabled={!canManage || pending}
                      onToggle={(value) => handleToggle(agent.id, "allowedModules", value)}
                    />

                    <div className="space-y-2">
                      <div>
                        <Label>Tools autorises</Label>
                        <p className="text-xs text-muted-foreground">
                          Garde-fou principal avant exposition a un agent runtime.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {snapshot.tools
                          .filter((tool) => agent.modules.includes(tool.module as any) || draft.allowedTools.includes(tool.id))
                          .map((tool) => (
                            <Button
                              key={tool.id}
                              type="button"
                              size="sm"
                              variant={draft.allowedTools.includes(tool.id) ? "default" : "outline"}
                              disabled={!canManage || pending}
                              onClick={() => handleToggle(agent.id, "allowedTools", tool.id)}
                              className="h-auto min-h-9 whitespace-normal text-left"
                            >
                              <span className="block">
                                <span className="block text-xs uppercase opacity-70">{tool.module}</span>
                                <span>{tool.label}</span>
                              </span>
                            </Button>
                          ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Notes runtime</Label>
                      <Textarea
                        value={draft.notes}
                        disabled={!canManage || pending}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [agent.id]: { ...prev[agent.id], notes: event.target.value },
                          }))
                        }
                        placeholder="Contraintes, politiques, contexte de supervision..."
                      />
                    </div>

                    <Separator />
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-muted-foreground">
                        Handoffs possibles : {agent.handoffTargets.join(", ")}
                      </div>
                      {canManage ? (
                        <Button onClick={() => saveAgent(agent.id)} disabled={pending}>
                          Sauvegarder
                        </Button>
                      ) : (
                        <Badge variant="secondary">Lecture seule</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="handoffs">
          <Card className="border-0 bg-muted/30">
            <CardHeader>
              <CardTitle>Inter-agent handoff</CardTitle>
              <p className="text-sm text-muted-foreground">
                Cree une tache agent-to-agent avec contexte ERP partage.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Agent source</Label>
                <Select value={handoff.sourceAgentId} onValueChange={(value) => setHandoff((prev) => ({ ...prev, sourceAgentId: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {snapshot.agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Agent cible</Label>
                <Select value={handoff.targetAgentId} onValueChange={(value) => setHandoff((prev) => ({ ...prev, targetAgentId: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {snapshot.agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Titre</Label>
                <Input
                  value={handoff.title}
                  onChange={(event) => setHandoff((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Ex: Escalader verification fournisseur QC"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Resume</Label>
                <Textarea
                  value={handoff.summary}
                  onChange={(event) => setHandoff((prev) => ({ ...prev, summary: event.target.value }))}
                  placeholder="Ce que l'agent source a deja fait, le risque, l'attendu du prochain agent."
                />
              </div>

              <div className="space-y-2">
                <Label>Module cible</Label>
                <Input
                  value={handoff.module}
                  onChange={(event) => setHandoff((prev) => ({ ...prev, module: event.target.value }))}
                  placeholder="sourcing / logistics / finance ..."
                />
              </div>
              <div className="space-y-2">
                <Label>Entity type</Label>
                <Input
                  value={handoff.entityType}
                  onChange={(event) => setHandoff((prev) => ({ ...prev, entityType: event.target.value }))}
                  placeholder="order / lead / sourcing_case"
                />
              </div>
              <div className="space-y-2">
                <Label>Entity id</Label>
                <Input
                  value={handoff.entityId}
                  onChange={(event) => setHandoff((prev) => ({ ...prev, entityId: event.target.value }))}
                  placeholder="cuid de l'entite"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={submitHandoff} disabled={pending || !canManage} className="w-full">
                  Creer le handoff
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tools">
          <Card className="border-0 bg-muted/30">
            <CardHeader>
              <CardTitle>Tool Catalog</CardTitle>
              <p className="text-sm text-muted-foreground">
                Facade commune que les agents doivent utiliser au lieu d'appels directs aux modules.
              </p>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border bg-background/80">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tool</TableHead>
                      <TableHead>Module</TableHead>
                      <TableHead>Risque</TableHead>
                      <TableHead>Expose a</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snapshot.tools.map((tool) => (
                      <TableRow key={tool.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{tool.label}</div>
                            <div className="text-xs text-muted-foreground">{tool.description}</div>
                            <div className="text-[11px] text-muted-foreground">{tool.id}</div>
                          </div>
                        </TableCell>
                        <TableCell className="uppercase">{tool.module}</TableCell>
                        <TableCell>
                          <Badge variant={tool.risk === "approval" ? "secondary" : tool.risk === "write" ? "default" : "outline"}>
                            {tool.risk}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {snapshot.agents
                            .filter((agent) => agent.allowedTools.includes(tool.id))
                            .map((agent) => agent.displayName)
                            .join(", ")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-background/80 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function OptionMatrix({
  title,
  description,
  items,
  selected,
  disabled,
  onToggle,
}: {
  title: string;
  description: string;
  items: string[];
  selected: string[];
  disabled?: boolean;
  onToggle: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div>
        <Label>{title}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Button
            key={item}
            type="button"
            size="sm"
            variant={selected.includes(item) ? "default" : "outline"}
            disabled={disabled}
            onClick={() => onToggle(item)}
          >
            {item}
          </Button>
        ))}
      </div>
    </div>
  );
}
