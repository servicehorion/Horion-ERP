import { getTeamMembers } from "@/lib/actions/team.actions";
import { TeamManager } from "@/components/settings/team-manager";

export default async function TeamPage() {
  const membersRes = await getTeamMembers();
  const members = membersRes?.data ?? [];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Equipe</h1>
        <p className="text-muted-foreground">Gestion des utilisateurs et roles</p>
      </div>
      <TeamManager members={members} />
    </div>
  );
}
