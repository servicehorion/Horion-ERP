"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Save, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { updateTenantSettings } from "@/lib/actions/tenant.actions";

type Tenant = {
  id: string;
  name: string;
  settings: Record<string, unknown>;
};

const TIMEZONES = [
  { value: "Africa/Brazzaville", label: "Brazzaville (WAT, UTC+1)" },
  { value: "Africa/Kinshasa", label: "Kinshasa (WAT, UTC+1)" },
  { value: "Africa/Lagos", label: "Lagos (WAT, UTC+1)" },
  { value: "Africa/Dakar", label: "Dakar (GMT, UTC+0)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST, UTC+8)" },
  { value: "Europe/Paris", label: "Paris (CET, UTC+1)" },
  { value: "UTC", label: "UTC" },
];

const CURRENCIES = [
  { value: "XAF", label: "XAF — Franc CFA BEAC" },
  { value: "USD", label: "USD — Dollar américain" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "CNY", label: "CNY — Yuan chinois (RMB)" },
];

export function BrandingClient({ tenant }: { tenant: Tenant }) {
  const settings = (tenant.settings ?? {}) as Record<string, string>;
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    logoUrl: (settings.logoUrl as string) ?? "",
    primaryColor: (settings.primaryColor as string) ?? "#1a56db",
    currency: (settings.currency as string) ?? "XAF",
    timezone: (settings.timezone as string) ?? "Africa/Brazzaville",
    companyName: (settings.companyName as string) ?? tenant.name,
    address: (settings.address as string) ?? "",
    nif: (settings.nif as string) ?? "",
    phone: (settings.phone as string) ?? "",
    email: (settings.email as string) ?? "",
  });

  function handleSave() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("currency", form.currency);
      formData.set("timezone", form.timezone);
      formData.set("primaryColor", form.primaryColor);
      formData.set("companyName", form.companyName);
      formData.set("address", form.address);
      formData.set("nif", form.nif);
      formData.set("phone", form.phone);
      formData.set("email", form.email);
      if (form.logoUrl) {
        formData.set("logoUrl", form.logoUrl);
      }

      const res = (await updateTenantSettings(formData)) as { error?: string };
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Paramètres sauvegardés");
      }
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marque & Apparence"
        description="Personnalisez l'identité visuelle et les informations de votre entreprise"
      >
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          <Save className="h-4 w-4 mr-2" />
          {isPending ? "Sauvegarde…" : "Sauvegarder"}
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Identité visuelle */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identité visuelle</CardTitle>
            <CardDescription>Logo, couleur de marque</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>URL du logo</Label>
              <Input
                placeholder="https://votre-domaine.com/logo.png"
                value={form.logoUrl}
                onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
              />
              {form.logoUrl && (
                <div className="mt-2 h-12 w-auto">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.logoUrl} alt="Logo" className="h-full object-contain rounded border p-1" />
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label>Couleur principale</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                  className="h-9 w-12 rounded cursor-pointer border"
                />
                <Input
                  value={form.primaryColor}
                  onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                  className="font-mono text-sm"
                  maxLength={7}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Devise par défaut</Label>
              <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Fuseau horaire</Label>
              <Select value={form.timezone} onValueChange={(v) => setForm({ ...form, timezone: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Informations société */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Informations société
            </CardTitle>
            <CardDescription>Utilisées sur les documents et factures</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>{"Nom de l'entreprise"}</Label>
              <Input
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label>NIF / RCCM</Label>
              <Input
                placeholder="M2025B123456"
                value={form.nif}
                onChange={(e) => setForm({ ...form, nif: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label>Adresse</Label>
              <Input
                placeholder="Rue Docteur Jamot, Brazzaville"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Téléphone</Label>
                <Input
                  placeholder="+242 06 XXX XXXX"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Email société</Label>
                <Input
                  type="email"
                  placeholder="contact@horion.cg"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
