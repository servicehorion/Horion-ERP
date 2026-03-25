"use client";

import { useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface CalendarTask {
  id: string;
  title: string;
  module: string;
  status: string;
  priority: string;
  dueDate: Date | string | null;
  slaDeadline: Date | string | null;
}

interface TaskCalendarClientProps {
  tasks: CalendarTask[];
  month: Date;
}

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function TaskCalendarClient({ tasks, month }: TaskCalendarClientProps) {
  const [selected, setSelected] = useState<Date | undefined>(undefined);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, CalendarTask[]>();
    tasks.forEach((t) => {
      const date = t.dueDate ?? t.slaDeadline;
      if (!date) return;
      const key = dateKey(new Date(date));
      const arr = map.get(key) || [];
      arr.push(t);
      map.set(key, arr);
    });
    return map;
  }, [tasks]);

  const selectedKey = selected ? dateKey(selected) : undefined;
  const dayTasks = selectedKey ? tasksByDay.get(selectedKey) || [] : [];

  const modifiers = useMemo(() => {
    const days: Date[] = [];
    tasksByDay.forEach((_value, key) => {
      days.push(new Date(key));
    });
    return { hasTasks: days };
  }, [tasksByDay]);

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <Calendar
        month={month}
        onMonthChange={() => {}}
        selected={selected}
        onSelect={setSelected}
        modifiers={modifiers}
        modifiersClassNames={{ hasTasks: "bg-primary/10" }}
      />

      <div className="space-y-3">
        <div className="text-sm text-muted-foreground">
          {selected ? `Taches du ${formatDate(selected, true)}` : "Selectionnez un jour"}
        </div>
        {selected && dayTasks.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucune tache ce jour</p>
        )}
        {dayTasks.map((t) => (
          <div key={t.id} className="border rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs capitalize">{t.module}</Badge>
              <span className="text-sm font-medium">{t.title}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {t.dueDate ? `Due: ${formatDate(new Date(t.dueDate), true)}` : `SLA: ${formatDate(new Date(t.slaDeadline!), true)}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
