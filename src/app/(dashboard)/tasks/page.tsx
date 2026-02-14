import { Suspense } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/shared/data-table";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { taskColumns, type TaskTableRow } from "@/components/tasks/task-table";
import { getTasks } from "@/lib/actions/task.actions";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Tâches | Horion ERP",
  description: "Task engine centralisé - toutes les opérations",
};

export default async function TasksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tâches</h1>
        <p className="text-muted-foreground">
          Task engine centralisé - toutes les opérations
        </p>
      </div>

      <Tabs defaultValue="all" className="space-y-6">
        <TabsList>
          <TabsTrigger value="all">Toutes</TabsTrigger>
          <TabsTrigger value="orders">Commandes</TabsTrigger>
          <TabsTrigger value="sourcing">Sourcing</TabsTrigger>
          <TabsTrigger value="logistics">Logistique</TabsTrigger>
          <TabsTrigger value="finance">Finance</TabsTrigger>
          <TabsTrigger value="qc">QC</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Suspense fallback={<TableSkeleton />}>
            <TasksList module={undefined} />
          </Suspense>
        </TabsContent>

        <TabsContent value="orders">
          <Suspense fallback={<TableSkeleton />}>
            <TasksList module="orders" />
          </Suspense>
        </TabsContent>

        <TabsContent value="sourcing">
          <Suspense fallback={<TableSkeleton />}>
            <TasksList module="sourcing" />
          </Suspense>
        </TabsContent>

        <TabsContent value="logistics">
          <Suspense fallback={<TableSkeleton />}>
            <TasksList module="logistics" />
          </Suspense>
        </TabsContent>

        <TabsContent value="finance">
          <Suspense fallback={<TableSkeleton />}>
            <TasksList module="finance" />
          </Suspense>
        </TabsContent>

        <TabsContent value="qc">
          <Suspense fallback={<TableSkeleton />}>
            <TasksList module="qc" />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}

async function TasksList({ module }: { module?: string }) {
  const result = await getTasks({ module });

  if (result.error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
        {result.error}
      </div>
    );
  }

  const tasks = result.data || [];

  if (tasks.length === 0) {
    return (
      <EmptyState
        title="Aucune tâche"
        description={
          module
            ? `Aucune tâche dans le module ${module}`
            : "Les tâches seront générées automatiquement par le système"
        }
      />
    );
  }

  // Count SLA breaches
  const slaBreaches = tasks.filter((t) => t.slaBreach).length;

  // Transform data for table
  const tableData: TaskTableRow[] = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    module: task.module,
    entityType: task.entityType,
    entityId: task.entityId,
    slaDeadline: task.slaDeadline,
    assignedTo: task.assignments?.[0]?.user || null,
    slaBreach: task.slaBreach,
  }));

  return (
    <div className="space-y-4">
      {slaBreaches > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <Badge variant="destructive">{slaBreaches}</Badge>
          <span className="text-sm text-destructive">
            tâche{slaBreaches > 1 ? "s" : ""} en retard (SLA dépassé)
          </span>
        </div>
      )}

      <DataTable
        columns={taskColumns}
        data={tableData}
        searchKey="title"
        searchPlaceholder="Rechercher une tâche..."
      />
    </div>
  );
}
