"use client";

import { useState } from "react";

import { TaskKanban } from "@/components/tasks/task-kanban";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TaskBoardGroupByProps {
  tasks: any[];
  module?: string;
}

type TaskGroupBy = "status" | "module" | "priority" | "assignee";

export function TaskBoardGroupBy({ tasks, module }: TaskBoardGroupByProps) {
  const [groupBy, setGroupBy] = useState<TaskGroupBy>("status");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Grouper par</span>
        <Select value={groupBy} onValueChange={(value) => setGroupBy(value as TaskGroupBy)}>
          <SelectTrigger className="h-8 w-full text-xs sm:w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="status">Statut</SelectItem>
            <SelectItem value="module">Module</SelectItem>
            <SelectItem value="priority">Priorite</SelectItem>
            <SelectItem value="assignee">Assigne</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <TaskKanban tasks={tasks} module={module} groupBy={groupBy} />
    </div>
  );
}
