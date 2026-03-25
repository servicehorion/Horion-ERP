import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";
import {
  createOrderApprovalRule,
  updateOrderApprovalRule,
  deleteOrderApprovalRule,
  moveOrderApprovalRule,
} from "@/lib/actions/order-approval.actions";

export const metadata = {
  title: "Regles d'approbation | Horion ERP",
};

export default async function ApprovalRulesPage() {
  const user = await getSession();
  checkPermission(user.role, "order.approve");

  const rules = await prisma.orderApprovalRule.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { sequence: "asc" },
  });

  const roles = Object.values(UserRole);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Regles d'approbation</h1>
        <p className="text-muted-foreground">
          Definir les seuils et roles requis pour valider une commande
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nouvelle regle</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createOrderApprovalRule} className="grid gap-3 md:grid-cols-6">
            <Input name="name" placeholder="Nom de la regle" className="md:col-span-2" required />
            <Input
              name="minAmountXAF"
              type="number"
              step="1000"
              placeholder="Seuil XAF"
              className="md:col-span-1"
              required
            />
            <Input
              name="sequence"
              type="number"
              step="1"
              placeholder="Ordre"
              className="md:col-span-1"
              required
            />
            <select
              name="requiredRole"
              className="h-10 rounded-md border bg-background px-3 text-sm md:col-span-1"
              required
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <Button type="submit" className="md:col-span-1">
              Ajouter
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Regles actives</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rules.length === 0 ? (
            <div className="text-sm text-muted-foreground">Aucune regle configuree.</div>
          ) : (
            rules.map((rule) => (
              <div key={rule.id} className="rounded-lg border p-3">
                <form
                  action={updateOrderApprovalRule.bind(null, rule.id)}
                  className="grid gap-3 md:grid-cols-8"
                >
                  <Input name="name" defaultValue={rule.name} className="md:col-span-2" required />
                  <Input
                    name="minAmountXAF"
                    type="number"
                    step="1000"
                    defaultValue={Number(rule.minAmountXAF)}
                    className="md:col-span-2"
                    required
                  />
                  <Input
                    name="sequence"
                    type="number"
                    step="1"
                    defaultValue={rule.sequence}
                    className="md:col-span-1"
                    required
                  />
                  <select
                    name="requiredRole"
                    defaultValue={rule.requiredRole}
                    className="h-10 rounded-md border bg-background px-3 text-sm md:col-span-2"
                    required
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2 md:col-span-1">
                    <Button type="submit" size="sm">
                      Save
                    </Button>
                    <Badge variant="secondary">#{rule.sequence}</Badge>
                  </div>
                </form>
                <div className="mt-2 flex flex-wrap gap-2">
                  <form action={moveOrderApprovalRule.bind(null, rule.id, "up")}>
                    <Button size="sm" variant="outline">
                      Monter
                    </Button>
                  </form>
                  <form action={moveOrderApprovalRule.bind(null, rule.id, "down")}>
                    <Button size="sm" variant="outline">
                      Descendre
                    </Button>
                  </form>
                  <form action={deleteOrderApprovalRule.bind(null, rule.id)}>
                    <Button size="sm" variant="destructive">
                      Supprimer
                    </Button>
                  </form>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
