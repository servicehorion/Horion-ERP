"use client";

import { useMemo, useState, useTransition } from "react";
import { BarChart3, Users, AlertTriangle, ArrowRightLeft, Activity } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { redeployTasks } from "@/lib/actions/pilotage.actions";

export type TeamWorkload = {
  userId: string;
  name: string;
  email: string;
  role: string;
  assignedCount: number;
  completedCount: number;
  slaBreaches: number;
  inProgressCount: number;
};

export type ModuleBreakdown = {
  module: string;
  total: number;
  pending: number;
  inProgress: number;
  blocked: number;
  slaBreaches: number;
};

export type PriorityDistribution = {
  LOW: number;
  NORMAL: number;
  HIGH: number;
  URGENT: number;
};

export function ResourceCommand({
  teamWorkload,
  moduleBreakdown,
  priorities,
}: {
  teamWorkload: TeamWorkload[];
  moduleBreakdown: ModuleBreakdown[];
  priorities: PriorityDistribution;
}) {
  const [fromUserId, setFromUserId] = useState("");
  const [toUserId, setToUserId] = useState("");
  const [limit, setLimit] = useState("3");
  const [module, setModule] = useState<string>("all");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ reassigned: number } | null>(null);

  const maxLoad = useMemo(
    () => Math.max(...teamWorkload.map((m) => m.assignedCount), 1),
    [teamWorkload]
  );

  const preview = useMemo(() => {
    const from = teamWorkload.find((u) => u.userId === fromUserId);
    const to = teamWorkload.find((u) => u.userId === toUserId);
    const count = Math.max(0, Number(limit) || 0);
    if (!from || !to || count === 0) return null;
    return {
      fromAfter: Math.max(0, from.assignedCount - count),
      toAfter: to.assignedCount + count,
    };
  }, [fromUserId, toUserId, limit, teamWorkload]);

  function handleRedeploy() {
    if (!fromUserId || !toUserId) {
      toast.error("Select users");
      return;
    }

    startTransition(async () => {
      const res = await redeployTasks({
        fromUserId,
        toUserId,
        limit: Number(limit) || 3,
        module: module === "all" ? undefined : module,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setResult({ reassigned: res.data?.reassigned || 0 });
      toast.success("Tasks redeployed");
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-indigo-500" /> Team workload heatmap
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {teamWorkload.map((member) => {
              const pct = Math.round((member.assignedCount / maxLoad) * 100);
              return (
                <div key={member.userId} className="flex items-center gap-3">
                  <div className="w-40">
                    <div className="text-sm font-medium">{member.name}</div>
                    <div className="text-xs text-muted-foreground">{member.role}</div>
                  </div>
                  <div className="flex-1">
                    <Progress value={pct} className="h-2" />
                  </div>
                  <div className="flex items-center gap-2 text-xs min-w-[120px] justify-end">
                    <Badge variant="outline">{member.assignedCount} active</Badge>
                    {member.slaBreaches > 0 && (
                      <Badge className="bg-red-100 text-red-700">{member.slaBreaches} SLA</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-blue-500" /> Module load
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {moduleBreakdown.map((mod) => {
              const maxTotal = Math.max(...moduleBreakdown.map((m) => m.total), 1);
              const pct = Math.round((mod.total / maxTotal) * 100);
              return (
                <div key={mod.module} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize">{mod.module}</span>
                    <span className="font-medium">{mod.total}</span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowRightLeft className="h-4 w-4 text-emerald-500" /> Redeploy tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>From</Label>
                <Select value={fromUserId} onValueChange={setFromUserId}>
                  <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                  <SelectContent>
                    {teamWorkload.map((m) => (
                      <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>To</Label>
                <Select value={toUserId} onValueChange={setToUserId}>
                  <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                  <SelectContent>
                    {teamWorkload.map((m) => (
                      <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Module scope</Label>
                <Select value={module} onValueChange={setModule}>
                  <SelectTrigger><SelectValue placeholder="All modules" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All modules</SelectItem>
                    {moduleBreakdown.map((m) => (
                      <SelectItem key={m.module} value={m.module}>{m.module}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tasks to move</Label>
                <Input value={limit} onChange={(e) => setLimit(e.target.value)} />
              </div>
            </div>

            {preview && (
              <div className="rounded border bg-slate-50 p-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Activity className="h-4 w-4" /> Impact preview
                </div>
                <div className="mt-2 flex items-center gap-6">
                  <div>
                    <div className="text-xs text-muted-foreground">From after</div>
                    <div className="text-base font-semibold">{preview.fromAfter}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">To after</div>
                    <div className="text-base font-semibold">{preview.toAfter}</div>
                  </div>
                </div>
              </div>
            )}

            <Button onClick={handleRedeploy} disabled={pending}>
              {pending ? "Redeploying..." : "Execute redeployment"}
            </Button>
            {result && (
              <div className="text-sm text-emerald-600">
                {result.reassigned} tasks reassigned
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Priority mix
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Urgent</span>
              <span className="font-semibold">{priorities.URGENT}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>High</span>
              <span className="font-semibold">{priorities.HIGH}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Normal</span>
              <span className="font-semibold">{priorities.NORMAL}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Low</span>
              <span className="font-semibold">{priorities.LOW}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
