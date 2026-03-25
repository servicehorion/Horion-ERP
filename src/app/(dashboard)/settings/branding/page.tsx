import { getTenantSettings, updateTenantSettings } from "@/lib/actions/tenant.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata = { title: "Branding | Horion ERP" };

const TIMEZONES = [
  "Africa/Brazzaville",
  "Africa/Lagos",
  "Africa/Abidjan",
  "Africa/Kinshasa",
  "UTC",
  "Europe/Paris",
];

const CURRENCIES = ["XAF", "USD", "EUR", "RMB"];

export default async function BrandingPage() {
  const res = await getTenantSettings();
  const tenant = res.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Branding</h1>
        <p className="text-muted-foreground">Logo, couleur primaire, devise, fuseau horaire</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Identite Horion</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateTenantSettings} className="grid grid-cols-1 lg:grid-cols-2 gap-6" encType="multipart/form-data">
            <div className="space-y-3">
              <label className="text-sm font-medium">Logo</label>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
                  {tenant?.branding?.logoPreviewUrl ? (
                    <img
                      src={tenant.branding.logoPreviewUrl}
                      alt="Logo"
                      className="h-16 w-16 object-contain"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">Logo</span>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <Input type="file" name="logo" accept="image/*" />
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input type="checkbox" name="clearLogo" className="h-4 w-4" />
                    Supprimer le logo actuel
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Couleur primaire</label>
              <div className="flex items-center gap-3">
                <Input
                  type="color"
                  name="primaryColor"
                  defaultValue={tenant?.branding?.primaryColor || "#0ea5e9"}
                  className="h-10 w-16 p-1"
                />
                <Input
                  type="text"
                  name="primaryColorText"
                  defaultValue={tenant?.branding?.primaryColor || "#0ea5e9"}
                  readOnly
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Cette couleur sera utilisee pour les themes et elements de navigation.
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Devise</label>
              <select
                name="currency"
                defaultValue={tenant?.currency || "XAF"}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {CURRENCIES.map((cur) => (
                  <option key={cur} value={cur}>
                    {cur}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Fuseau horaire</label>
              <select
                name="timezone"
                defaultValue={tenant?.timezone || "Africa/Brazzaville"}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2 flex justify-end">
              <Button type="submit">Enregistrer</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
