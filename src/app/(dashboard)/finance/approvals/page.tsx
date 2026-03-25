import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import {
  requestFinanceApproval,
  approveFinanceApproval,
  createFinanceApprovalRule,
  deleteFinanceApprovalRule,
} from "@/lib/actions/finance-advanced.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Approvals Finance | Horion ERP" };

async function requestFinanceApprovalAction(formData: FormData): Promise<void> {
  "use server";
  await requestFinanceApproval(formData);
}

async function createFinanceApprovalRuleAction(formData: FormData): Promise<void> {
  "use server";
  await createFinanceApprovalRule(formData);
}

async function deleteFinanceApprovalRuleAction(ruleId: string): Promise<void> {
  "use server";
  await deleteFinanceApprovalRule(ruleId);
}

async function approveFinanceApprovalAction(id: string, decision: "APPROVED" | "REJECTED"): Promise<void> {
  "use server";
  await approveFinanceApproval(id, decision);
}

export default async function FinanceApprovalsPage() {
  const user = await getSession();
  checkPermission(user.role, "finance.view");

  const [approvals, rules] = await Promise.all([
    prisma.financeApproval.findMany({
      where: { tenantId: user.tenantId },
      include: { requestedBy: true, approvedBy: true, rule: true },
      orderBy: [{ workflowId: "desc" }, { sequence: "asc" }],
      take: 300,
    }),
    prisma.financeApprovalRule.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      orderBy: [{ entityType: "asc" }, { sequence: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Workflows d'Approbation" description="Validation des paiements, factures, budgets" />

      <Card>
        <CardHeader>
          <CardTitle>Nouvelle demande</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={requestFinanceApprovalAction} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input name="entityType" placeholder="Type (invoice, payment, budget)" required />
            <Input name="entityId" placeholder="ID entite" required />
            <Input name="notes" placeholder="Notes" />
            <Button type="submit">Demander</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Regles actives ({rules.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={createFinanceApprovalRuleAction} className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <Input name="entityType" placeholder="invoice/payment/budget/*" required />
            <Input name="name" placeholder="Nom de la regle" required />
            <Input name="minAmountXAF" type="number" step="0.01" placeholder="Seuil XAF" required />
            <Input name="sequence" type="number" min={1} defaultValue={1} required />
            <Input name="requiredRole" placeholder="FINANCE_MANAGER" defaultValue="FINANCE_MANAGER" required />
            <Input name="slaHours" type="number" min={1} defaultValue={24} required />
            <Button className="md:col-span-6 justify-self-start" size="sm" type="submit">Ajouter regle</Button>
          </form>
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune regle active. Fallback: validation FINANCE_MANAGER sous 24h.</p>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between rounded border p-2 text-sm">
                  <div>
                    {rule.entityType} - Seq #{rule.sequence} - {rule.requiredRole} - seuil {Number(rule.minAmountXAF).toLocaleString("fr-FR")} XAF - SLA {rule.slaHours}h
                  </div>
                  <form action={deleteFinanceApprovalRuleAction.bind(null, rule.id)}>
                    <Button size="sm" variant="ghost">Supprimer</Button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Demandes en cours</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Entite</TableHead>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Role requis</TableHead>
                  <TableHead>Demandeur</TableHead>
                  <TableHead>Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvals.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.entityType}</TableCell>
                    <TableCell className="font-mono">{a.entityId}</TableCell>
                    <TableCell className="font-mono text-xs">{a.workflowId.slice(0, 8)} / #{a.sequence}</TableCell>
                    <TableCell>{a.status}</TableCell>
                    <TableCell>{a.requiredRole || a.rule?.requiredRole || "-"}</TableCell>
                    <TableCell>{a.requestedBy?.name || a.requestedById}</TableCell>
                    <TableCell className="space-x-2">
                      {a.status === "PENDING" ? (
                        <>
                          <form className="inline" action={approveFinanceApprovalAction.bind(null, a.id, "APPROVED")}>
                            <Button size="sm" variant="outline">Approuver</Button>
                          </form>
                          <form className="inline" action={approveFinanceApprovalAction.bind(null, a.id, "REJECTED")}>
                            <Button size="sm" variant="ghost">Rejeter</Button>
                          </form>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">{a.status}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {approvals.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                      Aucune demande
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
