import Link from "next/link";
import { ArrowLeft, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRecurringTasks, createRecurringTask, updateRecurringTask, deleteRecurringTask, getTaskTemplates } from "@/lib/actions/task.actions";
import { formatDate } from "@/lib/utils";

export const metadata = {
  title: "Recurrences | Horion ERP",
};

export default async function RecurringTasksPage() {
  const [recurringResult, templatesResult] = await Promise.all([
    getRecurringTasks(),
    getTaskTemplates(),
  ]);

  const recurring = recurringResult.data ?? [];
  const templates = templatesResult.data ?? [];

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
            <RotateCcw className="h-5 w-5" /> Recurrences
          </h1>
          <p className="text-muted-foreground">Templates recurrents et cron</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Creer une recurrence</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async (formData) => {
              "use server";
              await createRecurringTask({
                templateId: String(formData.get("templateId") || ""),
                cronExpression: String(formData.get("cronExpression") || ""),
                timezone: String(formData.get("timezone") || "Africa/Brazzaville"),
              });
            }}
            className="grid gap-3 md:grid-cols-4"
          >
            <select name="templateId" className="h-10 rounded-md border border-input bg-background px-3 text-sm" required>
              <option value="">Template</option>
              {templates.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <input name="cronExpression" placeholder="0 9 * * 1" className="h-10 rounded-md border border-input bg-background px-3 text-sm" required />
            <input name="timezone" placeholder="Africa/Brazzaville" className="h-10 rounded-md border border-input bg-background px-3 text-sm" />
            <Button type="submit">Ajouter</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recurrences actives</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="p-3 font-medium">Template</th>
                <th className="p-3 font-medium">Cron</th>
                <th className="p-3 font-medium">Timezone</th>
                <th className="p-3 font-medium">Prochaine</th>
                <th className="p-3 font-medium">Statut</th>
                <th className="p-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recurring.map((r: any) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3 font-medium">{r.template?.name || "-"}</td>
                  <td className="p-3 text-muted-foreground">{r.cronExpression}</td>
                  <td className="p-3 text-muted-foreground">{r.timezone}</td>
                  <td className="p-3 text-muted-foreground">{r.nextRunAt ? formatDate(r.nextRunAt, true) : "-"}</td>
                  <td className="p-3">{r.isActive ? "ACTIVE" : "PAUSE"}</td>
                  <td className="p-3 text-right space-x-2">
                    <form
                      action={async () => {
                        "use server";
                        await updateRecurringTask(r.id, { isActive: !r.isActive });
                      }}
                      className="inline"
                    >
                      <Button variant="outline" size="sm" type="submit">
                        {r.isActive ? "Desactiver" : "Activer"}
                      </Button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await deleteRecurringTask(r.id);
                      }}
                      className="inline"
                    >
                      <Button variant="ghost" size="sm" type="submit">Supprimer</Button>
                    </form>
                  </td>
                </tr>
              ))}
              {recurring.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">Aucune recurrence</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
