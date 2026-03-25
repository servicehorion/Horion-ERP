"use client";

import { useState, useTransition } from "react";
import {
  Palette,
  Plus,
  X,
  Save,
  Building2,
  MessageSquare,
  CheckCircle2,
  ShieldAlert,
  Link2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { saveBrandSettings, type BrandSettings } from "@/lib/actions/marketing.actions";

const FONT_OPTIONS = ["Inter", "Lato", "Montserrat", "Poppins", "Raleway", "Roboto", "Open Sans"];

const TONE_OPTIONS = [
  { value: "professionnel", label: "Professionnel & Expert" },
  { value: "amical",        label: "Amical & Accessible" },
  { value: "inspirant",     label: "Inspirant & Visionnaire" },
  { value: "direct",        label: "Direct & Percutant" },
  { value: "educatif",      label: "Éducatif & Pédagogique" },
  { value: "luxe",          label: "Luxe & Premium" },
];

interface Props {
  initialSettings: BrandSettings;
}

export function BrandCenter({ initialSettings }: Props) {
  const [brand, setBrand] = useState<BrandSettings>(initialSettings);
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<"idle" | "ok" | "err">("idle");

  const [newMessage, setNewMessage]     = useState("");
  const [newDo, setNewDo]               = useState("");
  const [newDont, setNewDont]           = useState("");
  const [newCompetitor, setNewCompetitor] = useState("");
  const [newAssetLabel, setNewAssetLabel] = useState("");
  const [newAssetUrl, setNewAssetUrl]     = useState("");

  const update = <K extends keyof BrandSettings>(key: K, value: BrandSettings[K]) =>
    setBrand((prev) => ({ ...prev, [key]: value }));

  const addItem = (field: "keyMessages" | "dos" | "donts" | "competitors", value: string) => {
    if (!value.trim()) return;
    update(field, [...(brand[field] as string[]), value.trim()]);
  };

  const removeItem = (field: "keyMessages" | "dos" | "donts" | "competitors", idx: number) => {
    update(field, (brand[field] as string[]).filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveBrandSettings(brand);
      if (result.success) {
        setSaveStatus("ok");
        setTimeout(() => setSaveStatus("idle"), 3000);
      } else {
        setSaveStatus("err");
        setTimeout(() => setSaveStatus("idle"), 5000);
      }
    });
  };

  return (
    <div className="space-y-6 pt-4">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-indigo-600" />
          <h2 className="text-lg font-semibold">Brand Identity Center</h2>
          <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300 text-xs">
            Charte de marque
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === "ok" && (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Sauvegardé
            </span>
          )}
          {saveStatus === "err" && (
            <span className="text-xs text-red-600 dark:text-red-400">Erreur lors de la sauvegarde</span>
          )}
          <Button onClick={handleSave} disabled={isPending} size="sm" className="gap-1.5">
            <Save className="h-4 w-4" />
            {isPending ? "Sauvegarde..." : "Sauvegarder"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left 2 cols ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Identity */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Building2 className="h-4 w-4 text-slate-500" />
                Identité visuelle
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nom de la marque</Label>
                <Input
                  value={brand.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="Horion"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tagline</Label>
                <Input
                  value={brand.tagline}
                  onChange={(e) => update("tagline", e.target.value)}
                  placeholder="Votre partenaire logistique"
                />
              </div>
              <div className="space-y-1.5">
                <Label>URL Logo</Label>
                <Input
                  value={brand.logoUrl}
                  onChange={(e) => update("logoUrl", e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Police principale</Label>
                <Select value={brand.font} onValueChange={(v) => update("font", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Color pickers */}
              {(["primaryColor", "secondaryColor", "accentColor"] as const).map((key) => {
                const labels: Record<typeof key, string> = {
                  primaryColor:   "Couleur principale",
                  secondaryColor: "Couleur secondaire",
                  accentColor:    "Couleur d'accent",
                };
                return (
                  <div key={key} className="space-y-1.5">
                    <Label>{labels[key]}</Label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={brand[key]}
                        onChange={(e) => update(key, e.target.value)}
                        className="h-9 w-12 cursor-pointer rounded border border-input p-0.5 shrink-0"
                      />
                      <Input
                        value={brand[key]}
                        onChange={(e) => update(key, e.target.value)}
                        className="font-mono text-sm"
                        placeholder="#6366f1"
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Tone of Voice */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <MessageSquare className="h-4 w-4 text-purple-500" />
                Ton de communication
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Ton de voix</Label>
                  <Select value={brand.tone} onValueChange={(v) => update("tone", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TONE_OPTIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Persona</Label>
                  <Input
                    value={brand.persona}
                    onChange={(e) => update("persona", e.target.value)}
                    placeholder="Expert logistique fiable et accessible"
                  />
                </div>
              </div>

              {/* Key messages */}
              <div className="space-y-2">
                <Label>Messages clés</Label>
                <div className="flex flex-wrap gap-2 min-h-8">
                  {brand.keyMessages.map((msg, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 text-xs pr-1 py-1">
                      {msg}
                      <button
                        onClick={() => removeItem("keyMessages", i)}
                        className="ml-0.5 hover:text-red-500 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Ajouter un message clé..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        addItem("keyMessages", newMessage);
                        setNewMessage("");
                      }
                    }}
                    className="flex-1 text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { addItem("keyMessages", newMessage); setNewMessage(""); }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Persona full */}
              <div className="space-y-1.5">
                <Label>Description du persona (détail)</Label>
                <Textarea
                  value={brand.persona}
                  onChange={(e) => update("persona", e.target.value)}
                  placeholder="Décrivez votre persona de marque en détail..."
                  rows={3}
                  className="resize-none text-sm"
                />
              </div>
            </CardContent>
          </Card>

          {/* Charte — Do's and Don'ts */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <ShieldAlert className="h-4 w-4 text-orange-500" />
                Charte de communication
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 sm:grid-cols-2">
                {/* Do's */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    À faire
                  </p>
                  <div className="space-y-1.5 min-h-16">
                    {brand.dos.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-md bg-green-50 dark:bg-green-950/20 px-3 py-1.5 text-xs text-green-800 dark:text-green-300"
                      >
                        <span className="flex-1">{item}</span>
                        <button
                          onClick={() => removeItem("dos", i)}
                          className="hover:text-red-500 shrink-0 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newDo}
                      onChange={(e) => setNewDo(e.target.value)}
                      placeholder="Ajouter une bonne pratique..."
                      onKeyDown={(e) => { if (e.key === "Enter") { addItem("dos", newDo); setNewDo(""); } }}
                      className="flex-1 text-xs h-8"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => { addItem("dos", newDo); setNewDo(""); }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Don'ts */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-1.5">
                    <X className="h-4 w-4" />
                    À éviter
                  </p>
                  <div className="space-y-1.5 min-h-16">
                    {brand.donts.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 rounded-md bg-red-50 dark:bg-red-950/20 px-3 py-1.5 text-xs text-red-800 dark:text-red-300"
                      >
                        <span className="flex-1">{item}</span>
                        <button
                          onClick={() => removeItem("donts", i)}
                          className="hover:text-red-500 shrink-0 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newDont}
                      onChange={(e) => setNewDont(e.target.value)}
                      placeholder="Ajouter une règle à éviter..."
                      onKeyDown={(e) => { if (e.key === "Enter") { addItem("donts", newDont); setNewDont(""); } }}
                      className="flex-1 text-xs h-8"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => { addItem("donts", newDont); setNewDont(""); }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right col — Preview + Assets + Competitors ── */}
        <div className="space-y-4">
          {/* Live Brand Preview */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Aperçu en direct</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Color bar */}
              <div className="h-7 rounded-lg flex overflow-hidden">
                <div className="flex-1" style={{ backgroundColor: brand.primaryColor }} />
                <div className="flex-1" style={{ backgroundColor: brand.secondaryColor }} />
                <div className="flex-1" style={{ backgroundColor: brand.accentColor }} />
              </div>

              {/* Brand card */}
              <div
                className="rounded-xl p-5 text-white"
                style={{ backgroundColor: brand.primaryColor }}
              >
                <p
                  className="text-2xl font-black leading-tight"
                  style={{ fontFamily: brand.font }}
                >
                  {brand.name || "Votre Marque"}
                </p>
                <p
                  className="text-sm opacity-80 mt-1"
                  style={{ fontFamily: brand.font }}
                >
                  {brand.tagline || "Votre slogan ici"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span
                    className="rounded-full px-3 py-1 text-xs font-semibold"
                    style={{ backgroundColor: brand.accentColor }}
                  >
                    {brand.tone || "Ton"}
                  </span>
                  {brand.keyMessages[0] && (
                    <span
                      className="rounded-full px-3 py-1 text-xs font-semibold opacity-80"
                      style={{ backgroundColor: brand.secondaryColor }}
                    >
                      {brand.keyMessages[0]}
                    </span>
                  )}
                </div>
              </div>

              {/* Color swatches */}
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Primaire",   key: "primaryColor" as const },
                  { label: "Secondaire", key: "secondaryColor" as const },
                  { label: "Accent",     key: "accentColor" as const },
                ].map(({ label, key }) => (
                  <div key={label} className="space-y-1">
                    <div
                      className="h-10 rounded-lg border shadow-sm"
                      style={{ backgroundColor: brand[key] }}
                    />
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-xs font-mono text-muted-foreground">{brand[key]}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Competitors */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Concurrents surveillés</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-1.5 min-h-8">
                {brand.competitors.map((c, i) => (
                  <Badge key={i} variant="outline" className="gap-1 text-xs pr-1">
                    {c}
                    <button
                      onClick={() => removeItem("competitors", i)}
                      className="ml-0.5 hover:text-red-500 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {brand.competitors.length === 0 && (
                  <p className="text-xs text-muted-foreground">Aucun concurrent ajouté</p>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newCompetitor}
                  onChange={(e) => setNewCompetitor(e.target.value)}
                  placeholder="Nom du concurrent..."
                  onKeyDown={(e) => { if (e.key === "Enter") { addItem("competitors", newCompetitor); setNewCompetitor(""); } }}
                  className="flex-1 text-xs h-8"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => { addItem("competitors", newCompetitor); setNewCompetitor(""); }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Asset Library */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Link2 className="h-4 w-4 text-slate-500" />
                Bibliothèque d&apos;assets
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {brand.assets.length === 0 && (
                <p className="text-xs text-muted-foreground">Aucun asset — logos, chartes, templates...</p>
              )}
              {brand.assets.map((asset, i) => (
                <div key={i} className="flex items-center gap-2 text-xs rounded-md border px-3 py-2">
                  <a
                    href={asset.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 font-medium text-blue-600 hover:underline truncate"
                  >
                    {asset.label}
                  </a>
                  <button
                    onClick={() => update("assets", brand.assets.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-red-500 shrink-0 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <Input
                  value={newAssetLabel}
                  onChange={(e) => setNewAssetLabel(e.target.value)}
                  placeholder="Nom de l'asset"
                  className="text-xs h-8"
                />
                <Input
                  value={newAssetUrl}
                  onChange={(e) => setNewAssetUrl(e.target.value)}
                  placeholder="URL"
                  className="text-xs h-8"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1 text-xs"
                onClick={() => {
                  if (!newAssetLabel.trim() || !newAssetUrl.trim()) return;
                  update("assets", [
                    ...brand.assets,
                    { label: newAssetLabel.trim(), url: newAssetUrl.trim() },
                  ]);
                  setNewAssetLabel("");
                  setNewAssetUrl("");
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Ajouter un asset
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
