"use client";

import { useMemo, useState } from "react";
import { Plus, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createGoal,
  deleteGoal,
  addKeyResult,
  updateKeyResult,
  deleteKeyResult,
  updateGoal,
} from "@/lib/actions/task.actions";
import { formatDate } from "@/lib/utils";

interface KeyResult {
  id: string;
  title: string;
  target: number;
  current: number;
  unit: string;
}

interface GoalItem {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  progress: number;
  targetDate?: string | Date | null;
  owner?: { id: string; name: string | null } | null;
  keyResults: KeyResult[];
}

interface GoalsClientProps {
  goals: GoalItem[];
  members: { id: string; name: string | null; email: string }[];
}

const STATUS_COLORS: Record<string, string> = {
  ON_TRACK: "bg-green-100 text-green-800",
  AT_RISK: "bg-amber-100 text-amber-800",
  BEHIND: "bg-red-100 text-red-800",
  ACHIEVED: "bg-blue-100 text-blue-800",
};

export function GoalsClient({ goals, members }: GoalsClientProps) {
  const router = useRouter();
  const [openGoal, setOpenGoal] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDesc, setGoalDesc] = useState("");
  const [goalOwner, setGoalOwner] = useState<string | undefined>(undefined);
  const [goalTargetDate, setGoalTargetDate] = useState("");

  const kpis = useMemo(() => {
    const active = goals.filter((g) => g.status !== "ACHIEVED").length;
    const atRisk = goals.filter((g) => g.status === "AT_RISK").length;
    const achieved = goals.filter((g) => g.status === "ACHIEVED").length;
    const avgProgress = goals.length > 0
      ? Math.round(goals.reduce((sum, g) => sum + (g.progress || 0), 0) / goals.length)
      : 0;
    return { active, atRisk, achieved, avgProgress };
  }, [goals]);

  const handleCreateGoal = async () => {
    if (!goalTitle.trim()) return;
    const res = await createGoal({
      title: goalTitle.trim(),
      description: goalDesc || undefined,
      ownerId: goalOwner || undefined,
      targetDate: goalTargetDate || undefined,
    });
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Objectif cree");
    setOpenGoal(false);
    setGoalTitle("");
    setGoalDesc("");
    setGoalOwner(undefined);
    setGoalTargetDate("");
    router.refresh();
  };

  const handleDeleteGoal = async (goalId: string) => {
    const res = await deleteGoal(goalId);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Objectif supprime");
    router.refresh();
  };

  const handleAddKr = async (goalId: string, title: string, target: number, unit: string) => {
    const res = await addKeyResult(goalId, { title, target, unit });
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Key result ajoute");
    router.refresh();
  };

  const handleUpdateKr = async (krId: string, current: number) => {
    const res = await updateKeyResult(krId, { current });
    if (res?.error) toast.error(res.error);
    else {
      toast.success("Mise a jour");
      router.refresh();
    }
  };

  const handleDeleteKr = async (krId: string) => {
    const res = await deleteKeyResult(krId);
    if (res?.error) toast.error(res.error);
    else {
      toast.success("Key result supprime");
      router.refresh();
    }
  };

  const handleUpdateStatus = async (goalId: string, status: string) => {
    const res = await updateGoal(goalId, { status });
    if (res?.error) toast.error(res.error);
    else router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Actifs</div>
            <div className="text-2xl font-bold">{kpis.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">En risque</div>
            <div className="text-2xl font-bold">{kpis.atRisk}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Realises</div>
            <div className="text-2xl font-bold">{kpis.achieved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Progression moyenne</div>
            <div className="text-2xl font-bold">{kpis.avgProgress}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Objectifs</h2>
        <Dialog open={openGoal} onOpenChange={setOpenGoal}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Nouvel objectif
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Creer un objectif</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Titre" value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} />
              <Textarea placeholder="Description" value={goalDesc} onChange={(e) => setGoalDesc(e.target.value)} />
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={goalOwner || ""}
                onChange={(e) => setGoalOwner(e.target.value || undefined)}
              >
                <option value="">Responsable</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name || m.email}</option>
                ))}
              </select>
              <Input type="date" value={goalTargetDate} onChange={(e) => setGoalTargetDate(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenGoal(false)}>Annuler</Button>
              <Button onClick={handleCreateGoal}>Creer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {goals.map((goal) => {
          const krProgress = goal.keyResults.length
            ? Math.round(goal.keyResults.reduce((sum, kr) => sum + (kr.current / (kr.target || 1)) * 100, 0) / goal.keyResults.length)
            : 0;
          return (
            <Card key={goal.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-4 w-4 text-blue-600" />
                  {goal.title}
                  <Badge className={STATUS_COLORS[goal.status] || "bg-muted"}>{goal.status}</Badge>
                  <div className="ml-auto text-xs text-muted-foreground">
                    {goal.targetDate ? formatDate(new Date(goal.targetDate), true) : "Sans date"}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {goal.description && <p className="text-sm text-muted-foreground">{goal.description}</p>}
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <Progress value={krProgress} className="h-2" />
                  </div>
                  <span className="text-sm font-medium">{krProgress}%</span>
                </div>

                <div className="space-y-2">
                  {goal.keyResults.map((kr) => (
                    <div key={kr.id} className="grid grid-cols-1 md:grid-cols-[1fr_120px_120px_auto] gap-2 items-center">
                      <div className="text-sm">
                        {kr.title}
                        <span className="text-xs text-muted-foreground ml-2">
                          {kr.current}/{kr.target} {kr.unit}
                        </span>
                      </div>
                      <Input
                        type="number"
                        placeholder="Current"
                        defaultValue={kr.current}
                        onBlur={(e) => handleUpdateKr(kr.id, Number(e.target.value || 0))}
                      />
                      <Button variant="outline" size="sm" onClick={() => handleUpdateKr(kr.id, kr.current)}>
                        Update
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteKr(kr.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  <AddKrInline goalId={goal.id} onAdd={handleAddKr} />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={goal.status}
                    onChange={(e) => handleUpdateStatus(goal.id, e.target.value)}
                  >
                    <option value="ON_TRACK">ON_TRACK</option>
                    <option value="AT_RISK">AT_RISK</option>
                    <option value="BEHIND">BEHIND</option>
                    <option value="ACHIEVED">ACHIEVED</option>
                  </select>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteGoal(goal.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {goals.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Aucun objectif defini
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function AddKrInline({ goalId, onAdd }: { goalId: string; onAdd: (goalId: string, title: string, target: number, unit: string) => void }) {
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState(0);
  const [unit, setUnit] = useState("%");

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_120px_auto] gap-2 items-center">
      <Input placeholder="Nouveau KR" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Input type="number" placeholder="Target" value={target || ""} onChange={(e) => setTarget(Number(e.target.value || 0))} />
      <Input placeholder="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
      <Button size="sm" onClick={() => { if (title.trim()) { onAdd(goalId, title, target, unit); setTitle(""); setTarget(0); } }}>
        Ajouter
      </Button>
    </div>
  );
}
