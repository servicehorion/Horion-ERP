import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createDelegationRule, setDelegationRuleActive } from "@/lib/actions/delegation.actions";

type Member = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
};

type DelegationRuleItem = {
  id: string;
  delegator: { id: string; name: string; email: string; role: string };
  delegatee: { id: string; name: string; email: string; role: string };
  permissions: unknown;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  maxAmountXAF: unknown;
  maxAmountUSD: unknown;
  maxAmountRMB: unknown;
  createdAt: Date;
};

const PERMISSIONS = [
  { value: "*", label: "Tout" },
  { value: "crm", label: "CRM" },
  { value: "orders", label: "Commandes" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "logistics", label: "Logistique" },
  { value: "sourcing", label: "Sourcing" },
  { value: "finance", label: "Finance" },
  { value: "marketing", label: "Marketing" },
  { value: "tasks", label: "Taches" },
  { value: "project", label: "Projets" },
  { value: "catalog", label: "Catalogue" },
];

const formatDate = (value?: Date | null) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR");
};

const formatAmount = (value?: unknown) => {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString("fr-FR");
};

const normalizePermissions = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
};

export function DelegationManager({
  members,
  rules,
}: {
  members: Member[];
  rules: DelegationRuleItem[];
}) {
  const activeMembers = members.filter((member) => member.isActive);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nouvelle delegation</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createDelegationRule} className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Delegant</label>
              <select
                name="delegatorId"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                required
              >
                <option value="">Selectionner</option>
                {activeMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} ({member.role})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Delegue</label>
              <select
                name="delegateeId"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                required
              >
                <option value="">Selectionner</option>
                {activeMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} ({member.role})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Debut</label>
              <Input type="date" name="startsAt" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Fin</label>
              <Input type="date" name="endsAt" />
            </div>
            <div className="lg:col-span-4 space-y-2">
              <label className="text-sm font-medium">Permissions deleguees</label>
              <div className="flex flex-wrap gap-3 text-sm">
                {PERMISSIONS.map((perm) => (
                  <label key={perm.value} className="flex items-center gap-2">
                    <input type="checkbox" name="permissions" value={perm.value} className="h-4 w-4" />
                    <span>{perm.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Seuil XAF</label>
              <Input type="number" name="maxAmountXAF" placeholder="5000000" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Seuil USD</label>
              <Input type="number" name="maxAmountUSD" placeholder="5000" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Seuil RMB</label>
              <Input type="number" name="maxAmountRMB" placeholder="20000" />
            </div>
            <div className="lg:col-span-4 space-y-2">
              <label className="text-sm font-medium">Conditions (JSON ou texte)</label>
              <textarea
                name="conditions"
                className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                placeholder={'Ex: {"module":"orders","note":"Remplace le manager pendant son absence"}'}
              />
            </div>
            <div className="lg:col-span-4 flex justify-end">
              <Button type="submit">Creer la delegation</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delegations actives</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Delegant</TableHead>
                  <TableHead>Delegue</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead>Seuils</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => {
                  const perms = normalizePermissions(rule.permissions);
                  return (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <div className="font-medium">{rule.delegator?.name}</div>
                        <div className="text-xs text-muted-foreground">{rule.delegator?.email}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{rule.delegatee?.name}</div>
                        <div className="text-xs text-muted-foreground">{rule.delegatee?.email}</div>
                      </TableCell>
                      <TableCell className="space-x-1">
                        {perms.length === 0 && (
                          <Badge variant="secondary">Aucune</Badge>
                        )}
                        {perms.map((perm) => (
                          <Badge key={perm} variant="outline">
                            {perm}
                          </Badge>
                        ))}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{formatDate(rule.startsAt)} → {formatDate(rule.endsAt)}</div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        XAF {formatAmount(rule.maxAmountXAF)} / USD {formatAmount(rule.maxAmountUSD)} / RMB {formatAmount(rule.maxAmountRMB)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={rule.isActive ? "default" : "secondary"}>
                          {rule.isActive ? "Actif" : "Inactif"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <form action={setDelegationRuleActive.bind(null, rule.id, !rule.isActive)}>
                          <Button size="sm" variant="outline">
                            {rule.isActive ? "Desactiver" : "Activer"}
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {rules.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                      Aucune delegation configuree
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
