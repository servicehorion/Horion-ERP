import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCalendarTasks } from "@/lib/actions/task.actions";
import { TaskCalendarClient } from "@/components/tasks/task-calendar-client";

export const metadata = {
  title: "Calendrier Taches | Horion ERP",
};

interface PageProps {
  searchParams?: { year?: string; month?: string };
}

export default async function TasksCalendarPage({ searchParams }: PageProps) {
  const now = new Date();
  const year = Number(searchParams?.year) || now.getFullYear();
  const monthIndex = (Number(searchParams?.month) || now.getMonth() + 1) - 1;

  const monthDate = new Date(year, monthIndex, 1);
  const prev = new Date(year, monthIndex - 1, 1);
  const next = new Date(year, monthIndex + 1, 1);

  const result = await getCalendarTasks(year, monthIndex);
  const tasks = result.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/tasks">
              <ArrowLeft className="h-4 w-4 mr-1" />Retour
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Calendrier</h1>
            <p className="text-muted-foreground">Vue mensuelle des taches</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/tasks/calendar?year=${prev.getFullYear()}&month=${prev.getMonth() + 1}`}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-2 text-sm font-medium">
            <CalendarIcon className="h-4 w-4" />
            {monthDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/tasks/calendar?year=${next.getFullYear()}&month=${next.getMonth() + 1}`}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Taches par jour</CardTitle>
        </CardHeader>
        <CardContent>
          <TaskCalendarClient tasks={tasks} month={monthDate} />
        </CardContent>
      </Card>
    </div>
  );
}
