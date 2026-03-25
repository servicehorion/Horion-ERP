import Link from "next/link";
import { ArrowLeft, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getGoals, getTeamMembers } from "@/lib/actions/task.actions";
import { GoalsClient } from "@/components/tasks/goals-client";

export const metadata = {
  title: "Goals / OKRs | Horion ERP",
};

export default async function TasksGoalsPage() {
  const [goalsResult, membersResult] = await Promise.all([
    getGoals(),
    getTeamMembers(),
  ]);

  const goals = goalsResult.data ?? [];
  const members = membersResult.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/tasks">
            <ArrowLeft className="h-4 w-4 mr-1" />Retour
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Target className="h-5 w-5" /> Goals / OKRs
          </h1>
          <p className="text-muted-foreground">Objectifs et Key Results</p>
        </div>
      </div>

      <GoalsClient goals={goals as any} members={members as any} />
    </div>
  );
}
