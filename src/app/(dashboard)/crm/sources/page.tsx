import { getInboundSources, getInboundEvents, createInboundSource, toggleInboundSource, rotateInboundToken } from "@/lib/actions/crm-ingestion.actions";
import { createLeadMiningProvider, createLeadMiningJob, getLeadMiningProviders, getLeadMiningJobs } from "@/lib/actions/lead-mining.actions";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export const metadata = {
  title: "CRM Sources | Horion ERP",
};

export default async function CrmSourcesPage() {
  const [sourcesResult, eventsResult, providersResult, jobsResult] = await Promise.all([
    getInboundSources(),
    getInboundEvents(20),
    getLeadMiningProviders(),
    getLeadMiningJobs(),
  ]);

  const sources = sourcesResult.data ?? [];
  const events = eventsResult.data ?? [];
  const providers = providersResult.data ?? [];
  const jobs = jobsResult.data ?? [];

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold">Sources & Lead Mining</h1>
        <p className="text-sm text-muted-foreground">
          Configurez les sources entrantes (email, formulaires) et les providers de lead mining.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sources entrantes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            action={async (formData) => {
              "use server";
              await createInboundSource({
                type: String(formData.get("type") || "EMAIL_ALIAS") as any,
                name: String(formData.get("name") || ""),
                emailAlias: String(formData.get("emailAlias") || "") || null,
                formToken: null,
              });
            }}
            className="grid gap-3 md:grid-cols-4"
          >
            <Input name="name" placeholder="Nom de la source" required />
            <Input name="emailAlias" placeholder="alias@horion.com (email)" />
            <select
              name="type"
              defaultValue="EMAIL_ALIAS"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="EMAIL_ALIAS">Email alias</option>
              <option value="WEB_FORM">Formulaire web</option>
              <option value="API">API</option>
            </select>
            <Button type="submit">Ajouter</Button>
          </form>

          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="p-3 font-medium">Nom</th>
                  <th className="p-3 font-medium">Type</th>
                  <th className="p-3 font-medium">Alias / Token</th>
                  <th className="p-3 font-medium">Statut</th>
                  <th className="p-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source: any) => (
                  <tr key={source.id} className="border-t">
                    <td className="p-3 font-medium">{source.name}</td>
                    <td className="p-3">{source.type}</td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {source.type === "EMAIL_ALIAS" ? source.emailAlias : source.formToken}
                    </td>
                    <td className="p-3">
                      <Badge variant={source.status === "ACTIVE" ? "default" : "secondary"}>
                        {source.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <form
                        action={async () => {
                          "use server";
                          await toggleInboundSource(source.id, source.status === "ACTIVE" ? "DISABLED" : "ACTIVE");
                        }}
                        className="inline"
                      >
                        <Button variant="outline" size="sm" type="submit">
                          {source.status === "ACTIVE" ? "Desactiver" : "Activer"}
                        </Button>
                      </form>
                      {source.type === "WEB_FORM" && (
                        <form
                          action={async () => {
                            "use server";
                            await rotateInboundToken(source.id);
                          }}
                          className="inline"
                        >
                          <Button variant="ghost" size="sm" type="submit">
                            Regenerer token
                          </Button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
                {sources.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      Aucune source configuree
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
          <CardTitle>Evenements entrants</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="p-3 font-medium">Source</th>
                <th className="p-3 font-medium">Contact</th>
                <th className="p-3 font-medium">Lead</th>
                <th className="p-3 font-medium">Statut</th>
                <th className="p-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event: any) => (
                <tr key={event.id} className="border-t">
                  <td className="p-3">{event.source?.name || event.sourceType}</td>
                  <td className="p-3">{event.contact?.name || "-"}</td>
                  <td className="p-3">{event.lead?.status || "-"}</td>
                  <td className="p-3">{event.status}</td>
                  <td className="p-3 text-muted-foreground">{formatDate(event.createdAt)}</td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    Aucun evenement recu
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Lead mining providers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            action={async (formData) => {
              "use server";
              await createLeadMiningProvider({
                name: String(formData.get("name") || ""),
                provider: String(formData.get("provider") || ""),
                apiUrl: String(formData.get("apiUrl") || "") || null,
                apiToken: String(formData.get("apiToken") || "") || null,
              });
            }}
            className="grid gap-3 md:grid-cols-4"
          >
            <Input name="name" placeholder="Nom provider" required />
            <Input name="provider" placeholder="Type (n8n, apollo...)" required />
            <Input name="apiUrl" placeholder="Webhook URL" />
            <Input name="apiToken" placeholder="API token" />
            <Button type="submit">Ajouter provider</Button>
          </form>

          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="p-3 font-medium">Nom</th>
                  <th className="p-3 font-medium">Provider</th>
                  <th className="p-3 font-medium">API URL</th>
                  <th className="p-3 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((provider: any) => (
                  <tr key={provider.id} className="border-t">
                    <td className="p-3 font-medium">{provider.name}</td>
                    <td className="p-3">{provider.provider}</td>
                    <td className="p-3 text-xs text-muted-foreground">{provider.apiUrl || "-"}</td>
                    <td className="p-3">{provider.status}</td>
                  </tr>
                ))}
                {providers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-muted-foreground">
                      Aucun provider configure
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
          <CardTitle>Jobs de lead mining</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            action={async (formData) => {
              "use server";
              await createLeadMiningJob({
                providerId: String(formData.get("providerId") || "") || null,
                query: String(formData.get("query") || ""),
              });
            }}
            className="grid gap-3 md:grid-cols-3"
          >
            <Input name="query" placeholder="Recherche (secteur, pays, taille...)" required />
            <select
              name="providerId"
              defaultValue={providers[0]?.id}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {providers.map((provider: any) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
            <Button type="submit">Lancer job</Button>
          </form>

          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="p-3 font-medium">Query</th>
                  <th className="p-3 font-medium">Provider</th>
                  <th className="p-3 font-medium">Statut</th>
                  <th className="p-3 font-medium text-right">Results</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job: any) => (
                  <tr key={job.id} className="border-t">
                    <td className="p-3 font-medium">{job.query}</td>
                    <td className="p-3">{job.provider?.name || "-"}</td>
                    <td className="p-3">{job.status}</td>
                    <td className="p-3 text-right">{job.resultCount}</td>
                  </tr>
                ))}
                {jobs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-muted-foreground">
                      Aucun job lance
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
