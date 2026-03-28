"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PlusCircle, Trash2, ToggleLeft, ToggleRight, RefreshCw, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard, KpiGrid } from "@/components/shared/kpi-card";
import {
  getRecurringTasks,
  createRecurringTask,
  toggleRecurringTask,
  deleteRecurringTask,
} from "@/lib/actions/recurring.actions";

type RecurringTask = {
  id: string;
  cronExpression: string;
  timezone: string;
  isActive: boolean;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  template: { id: string; name: string; module: string; defaultPriority: string };
};

type Template = { id: string; name: string; module: string; defaultPriority?: string };

const CRON_PRESETS = [
  { label: "Chaque lundi à 9h", value: "0 9 * * 1" },
  { label: "Chaque jour à 8h", value: "0 8 * * *" },
  { label: "1er du mois à 9h", value: "0 9 1 * *" },
  { label: "Chaque vendredi à 17h", value: "0 17 * * 5" },
  { label: "Chaque semaine (dim. 8h)", value: "0 8 * * 0" },
  { label: "Personnalisé", value: "custom" },
];

function formatDate(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function RecurringTasksClient({
  initialRecurring,
  templates,
}: {
  initialRecurring: RecurringTask[];
  templates: Template[];
}) {
  const [recurring, setRecurring] = useState<RecurringTask[]>(initialRecurring);
  const [isPending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    templateId: "",
    cronPreset: "0 9 * * 1",
    cronCustom: "",
  });

  function refresh() {
    startTransition(async () => {
      const res = await getRecurringTasks();
      if (res.data) setRecurring(res.data as unknown as RecurringTask[]);
    });
  }

  function handleCreate() {
    if (!form.templateId) { toast.error("Sélectionnez un template"); return; }
    const cron = form.cronPreset === "custom" ? form.cronCustom : form.cronPreset;
    if (!cron) { toast.error("Expression cron requise"); return; }

    startTransition(async () => {
      const res = (await createRecurringTask({ templateId: form.templateId, cronExpression: cron })) as { error?: string };
      if (res.error) { toast.error(res.error); return; }
      toast.success("Récurrence créée");
      setCreateOpen(false);
      setForm({ templateId: "", cronPreset: "0 9 * * 1", cronCustom: "" });
      refresh();
    });
  }

  function handleToggle(id: string) {
    startTransition(async () => {
      const res = (await toggleRecurringTask(id)) as { error?: string };
      if (res.error) { toast.error(res.error); return; }
      refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteRecurringTask(id);
      toast.success("Récurrence supprimée");
      refresh();
    });
  }

  const activeCount = recurring.filter((r) => r.isActive).length;
  const inactiveCount = recurring.filter((r) => !r.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tâches récurrentes"
        description="Automatisez la création de tâches selon un planning cron"
      >
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Nouvelle récurrence
        </Button>
      </PageHeader>

      <KpiGrid cols={3}>
        <KpiCard label="Récurrences configurées" value={recurring.length} icon={<RefreshCw className="h-4 w-4 text-muted-foreground" />} />
        <KpiCard label="Actives" value={activeCount} variant="success" icon={<ToggleRight className="h-4 w-4 text-muted-foreground" />} />
        <KpiCard label="Désactivées" value={inactiveCount} variant={inactiveCount > 0 ? "warning" : "default"} icon={<Clock className="h-4 w-4 text-muted-foreground" />} />
      </KpiGrid>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Planning (cron)</TableHead>
              <TableHead>Prochain déclenchement</TableHead>
              <TableHead>Dernier déclenchement</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {recurring.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Aucune tâche récurrente configurée
                </TableCell>
              </TableRow>
            ) : (
              recurring.map((rec) => (
                <TableRow key={rec.id} className={!rec.isActive ? "opacity-50" : ""}>
                  <TableCell className="font-medium text-sm">{rec.template.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{rec.template.module}</Badge>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{rec.cronExpression}</code>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(rec.nextRunAt)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(rec.lastRunAt)}</TableCell>
                  <TableCell>
                    {rec.isActive ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-100 text-xs">Actif</Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-300 text-xs">Inactif</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleToggle(rec.id)}
                        disabled={isPending}
                        title={rec.isActive ? "Désactiver" : "Activer"}
                      >
                        {rec.isActive ? <ToggleRight className="h-4 w-4 text-green-500" /> : <ToggleLeft className="h-4 w-4 text-gray-400" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(rec.id)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle récurrence</DialogTitle>
            <DialogDescription>
              Associez un template de tâche à un planning automatique.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Template *</Label>
              <Select value={form.templateId} onValueChange={(v) => setForm({ ...form, templateId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un template…" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} <span className="text-muted-foreground text-xs ml-1">({t.module})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Fréquence</Label>
              <Select value={form.cronPreset} onValueChange={(v) => setForm({ ...form, cronPreset: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CRON_PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.cronPreset === "custom" && (
              <div className="space-y-1">
                <Label>Expression cron personnalisée</Label>
                <Input
                  placeholder="ex: 0 9 * * 1"
                  value={form.cronCustom}
                  onChange={(e) => setForm({ ...form, cronCustom: e.target.value })}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">Format : min heure jour mois jour-semaine</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={isPending || !form.templateId}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
