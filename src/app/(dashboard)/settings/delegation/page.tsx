import { getDelegationRules } from "@/lib/actions/delegation.actions";
import { getTeamMembers } from "@/lib/actions/team.actions";
import { DelegationManager } from "@/components/settings/delegation-manager";

export default async function DelegationPage() {
  const [membersRes, rulesRes] = await Promise.all([
    getTeamMembers(),
    getDelegationRules(),
  ]);
  const members = membersRes?.data ?? [];
  const rules = rulesRes?.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Delegations</h1>
        <p className="text-muted-foreground">Regles d'approbation et seuils d'autonomie</p>
      </div>
      <DelegationManager members={members as any} rules={rules as any} />
    </div>
  );
}
