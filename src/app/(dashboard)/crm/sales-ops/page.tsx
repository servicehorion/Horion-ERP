import { getSalesTeams, getSalesTerritories, getSalesQuotas, createSalesTeam, createSalesTerritory, createSalesQuota } from "@/lib/actions/sales-ops.actions";
import { getTeamMembers } from "@/lib/actions/task.actions";
import { formatDate } from "@/lib/utils";
import { formatCurrency } from "@/config/currencies";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata = {
  title: "Sales Ops CRM | Horion ERP",
};

export default async function SalesOpsPage() {
  const [teamsResult, territoriesResult, quotasResult, membersResult] = await Promise.all([
    getSalesTeams(),
    getSalesTerritories(),
    getSalesQuotas(),
    getTeamMembers("crm"),
  ]);

  const teams = teamsResult.data ?? [];
  const territories = territoriesResult.data ?? [];
  const quotas = quotasResult.data ?? [];
  const members = membersResult.data ?? [];

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold">Sales Ops</h1>
        <p className="text-sm text-muted-foreground">
          Equipes commerciales, territoires et quotas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Territoires</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            action={async (formData) => {
              "use server";
              const countries = String(formData.get("countries") || "")
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean);
              const cities = String(formData.get("cities") || "")
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean);
              await createSalesTerritory({
                name: String(formData.get("name") || ""),
                countryCodes: countries,
                cityNames: cities,
              });
            }}
            className="grid gap-3 md:grid-cols-4"
          >
            <Input name="name" placeholder="Nom territoire" required />
            <Input name="countries" placeholder="Pays (CG, CM, CD)" />
            <Input name="cities" placeholder="Villes (Brazza, Pointe-Noire)" />
            <Button type="submit">Ajouter</Button>
          </form>

          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="p-3 font-medium">Nom</th>
                  <th className="p-3 font-medium">Pays</th>
                  <th className="p-3 font-medium">Villes</th>
                </tr>
              </thead>
              <tbody>
                {territories.map((territory: any) => (
                  <tr key={territory.id} className="border-t">
                    <td className="p-3 font-medium">{territory.name}</td>
                    <td className="p-3 text-muted-foreground">
                      {(territory.countryCodes || []).join(", ")}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {(territory.cityNames || []).join(", ")}
                    </td>
                  </tr>
                ))}
                {territories.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-muted-foreground">
                      Aucun territoire
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Equipes commerciales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            action={async (formData) => {
              "use server";
              await createSalesTeam({
                name: String(formData.get("name") || ""),
                managerId: String(formData.get("managerId") || "") || null,
                territoryId: String(formData.get("territoryId") || "") || null,
                targetAmount: Number(formData.get("targetAmount") || 0),
              });
            }}
            className="grid gap-3 md:grid-cols-4"
          >
            <Input name="name" placeholder="Nom equipe" required />
            <select name="managerId" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Manager</option>
              {members.map((member: any) => (
                <option key={member.id} value={member.id}>
                  {member.name || member.email}
                </option>
              ))}
            </select>
            <select name="territoryId" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Territoire</option>
              {territories.map((territory: any) => (
                <option key={territory.id} value={territory.id}>
                  {territory.name}
                </option>
              ))}
            </select>
            <Input name="targetAmount" placeholder="Target XAF" type="number" min="0" />
            <Button type="submit">Ajouter</Button>
          </form>

          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="p-3 font-medium">Equipe</th>
                  <th className="p-3 font-medium">Manager</th>
                  <th className="p-3 font-medium">Territoire</th>
                  <th className="p-3 font-medium text-right">Objectif</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team: any) => (
                  <tr key={team.id} className="border-t">
                    <td className="p-3 font-medium">{team.name}</td>
                    <td className="p-3 text-muted-foreground">{team.manager?.name || team.manager?.email || "-"}</td>
                    <td className="p-3 text-muted-foreground">{team.territory?.name || "-"}</td>
                    <td className="p-3 text-right">{formatCurrency(Number(team.targetAmount || 0), team.currency || "XAF")}</td>
                  </tr>
                ))}
                {teams.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-muted-foreground">
                      Aucune equipe
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quotas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            action={async (formData) => {
              "use server";
              await createSalesQuota({
                teamId: String(formData.get("teamId") || "") || null,
                userId: String(formData.get("userId") || "") || null,
                periodStart: String(formData.get("periodStart") || ""),
                periodEnd: String(formData.get("periodEnd") || ""),
                targetAmount: Number(formData.get("targetAmount") || 0),
              });
            }}
            className="grid gap-3 md:grid-cols-5"
          >
            <select name="teamId" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Equipe</option>
              {teams.map((team: any) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            <select name="userId" className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Commercial</option>
              {members.map((member: any) => (
                <option key={member.id} value={member.id}>
                  {member.name || member.email}
                </option>
              ))}
            </select>
            <Input name="periodStart" type="date" required />
            <Input name="periodEnd" type="date" required />
            <Input name="targetAmount" type="number" placeholder="Objectif XAF" min="0" />
            <Button type="submit">Ajouter</Button>
          </form>

          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="p-3 font-medium">Equipe</th>
                  <th className="p-3 font-medium">Commercial</th>
                  <th className="p-3 font-medium">Periode</th>
                  <th className="p-3 font-medium text-right">Objectif</th>
                </tr>
              </thead>
              <tbody>
                {quotas.map((quota: any) => (
                  <tr key={quota.id} className="border-t">
                    <td className="p-3 font-medium">{quota.team?.name || "-"}</td>
                    <td className="p-3 text-muted-foreground">{quota.user?.name || quota.user?.email || "-"}</td>
                    <td className="p-3 text-muted-foreground">
                      {formatDate(quota.periodStart)} - {formatDate(quota.periodEnd)}
                    </td>
                    <td className="p-3 text-right">{formatCurrency(Number(quota.targetAmount || 0), quota.currency || "XAF")}</td>
                  </tr>
                ))}
                {quotas.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-muted-foreground">
                      Aucun quota
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
