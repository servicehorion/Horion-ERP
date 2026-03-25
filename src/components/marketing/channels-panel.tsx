"use client";

import { useState, useTransition } from "react";
import {
  Plus,
  Trash2,
  Radio,
  Loader2,
  ExternalLink,
  Link as LinkIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createMarketingChannel,
  deleteMarketingChannel,
  type ChannelItem,
  type SocialAccountItem,
} from "@/lib/actions/marketing.actions";

// ── Config ─────────────────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<string, { label: string; emoji: string; color: string; bgColor: string }> = {
  FACEBOOK:  { label: "Facebook",  emoji: "📘", color: "text-blue-700",   bgColor: "bg-blue-50 border-blue-200" },
  INSTAGRAM: { label: "Instagram", emoji: "📷", color: "text-pink-700",   bgColor: "bg-pink-50 border-pink-200" },
  LINKEDIN:  { label: "LinkedIn",  emoji: "💼", color: "text-indigo-700", bgColor: "bg-indigo-50 border-indigo-200" },
  TIKTOK:    { label: "TikTok",    emoji: "🎵", color: "text-slate-700",  bgColor: "bg-slate-50 border-slate-200" },
  EMAIL:     { label: "Email",     emoji: "📧", color: "text-gray-700",   bgColor: "bg-gray-50 border-gray-200" },
  WHATSAPP:  { label: "WhatsApp",  emoji: "💬", color: "text-green-700",  bgColor: "bg-green-50 border-green-200" },
  YOUTUBE:   { label: "YouTube",   emoji: "▶️", color: "text-red-700",    bgColor: "bg-red-50 border-red-200" },
  TWITTER:   { label: "X / Twitter", emoji: "𝕏", color: "text-gray-900",  bgColor: "bg-gray-50 border-gray-200" },
};

const CHANNEL_TYPES = [
  { value: "social",          label: "Réseau social" },
  { value: "whatsapp_group",  label: "Groupe WhatsApp" },
  { value: "whatsapp_channel", label: "Canal WhatsApp" },
  { value: "email",           label: "Email / Newsletter" },
  { value: "messaging",       label: "Messagerie" },
  { value: "other",           label: "Autre" },
];

const CATEGORIES = [
  { value: "clients",      label: "Clients" },
  { value: "prospects",    label: "Prospects" },
  { value: "fournisseurs", label: "Fournisseurs" },
  { value: "partenaires",  label: "Partenaires" },
  { value: "transporteurs", label: "Transporteurs" },
  { value: "general",      label: "Général" },
];

// ── Social Account Cards (Decorative — state for future OAuth integration) ─

const SOCIAL_PLATFORMS = ["FACEBOOK", "INSTAGRAM", "LINKEDIN", "TIKTOK"];

function SocialAccountCard({
  platform,
  account,
}: {
  platform: string;
  account?: SocialAccountItem;
}) {
  const cfg = PLATFORM_CONFIG[platform] ?? { label: platform, emoji: "📡", color: "text-gray-700", bgColor: "bg-gray-50 border-gray-200" };
  const isConnected = account?.authStatus === "connected";

  return (
    <Card className={`border ${isConnected ? "border-green-200 bg-green-50/30 dark:bg-green-950/20" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{cfg.emoji}</span>
          <div className="flex-1">
            <p className="font-medium text-sm">{cfg.label}</p>
            {account?.handle && (
              <p className="text-xs text-muted-foreground">@{account.handle}</p>
            )}
            {account?.followerCount != null && account.followerCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {account.followerCount.toLocaleString("fr-FR")} abonnés
              </p>
            )}
          </div>
          <Badge
            variant="secondary"
            className={
              isConnected
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-600"
            }
          >
            {isConnected ? "Connecté" : "Non connecté"}
          </Badge>
        </div>
        {!isConnected && (
          <Button variant="outline" size="sm" className="w-full mt-3 h-8 text-xs" disabled>
            Connecter via API (bientôt)
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ── Add Channel Dialog ─────────────────────────────────────────────────────

function AddChannelDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({
    platform: "WHATSAPP",
    type: "whatsapp_group",
    name: "",
    link: "",
    category: "",
  });
  const [isPending, startTransition] = useTransition();

  function field(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    if (!form.name) return;
    startTransition(async () => {
      await createMarketingChannel({
        platform: form.platform,
        type: form.type,
        name: form.name,
        link: form.link || undefined,
        category: form.category || undefined,
      });
      onClose();
      window.location.reload();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un canal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Plateforme</Label>
              <Select value={form.platform} onValueChange={(v) => field("platform", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PLATFORM_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v.emoji} {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => field("type", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Nom du canal *</Label>
            <Input
              placeholder="ex: Clients Brazza Pro, Newsletter Mensuelle..."
              value={form.name}
              onChange={(e) => field("name", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Catégorie</Label>
            <Select value={form.category} onValueChange={(v) => field("category", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir..." />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Lien (optionnel)</Label>
            <Input
              placeholder="https://..."
              value={form.link}
              onChange={(e) => field("link", e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !form.name}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Channel Row ────────────────────────────────────────────────────────────

function ChannelRow({ channel }: { channel: ChannelItem }) {
  const [isDeleting, startTransition] = useTransition();
  const cfg = PLATFORM_CONFIG[channel.platform] ?? { label: channel.platform, emoji: "📡", color: "text-gray-700", bgColor: "" };
  const typeCfg = CHANNEL_TYPES.find((t) => t.value === channel.type);
  const catCfg = CATEGORIES.find((c) => c.value === channel.category);

  function handleDelete() {
    if (!confirm(`Supprimer le canal "${channel.name}" ?`)) return;
    startTransition(async () => {
      await deleteMarketingChannel(channel.id);
      window.location.reload();
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/40">
      <span className="text-xl shrink-0">{cfg.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{channel.name}</p>
          {channel.link && (
            <a
              href={channel.link}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0"
            >
              <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
            </a>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">{typeCfg?.label ?? channel.type}</span>
          {catCfg && (
            <>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{catCfg.label}</span>
            </>
          )}
        </div>
      </div>
      <Badge
        variant="secondary"
        className={
          channel.status === "active"
            ? "bg-green-100 text-green-800 text-xs"
            : "bg-gray-100 text-gray-600 text-xs"
        }
      >
        {channel.status === "active" ? "Actif" : "Inactif"}
      </Badge>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-red-600 shrink-0"
        onClick={handleDelete}
        disabled={isDeleting}
      >
        {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

interface Props {
  channels: ChannelItem[];
  socialAccounts: SocialAccountItem[];
}

export function ChannelsPanel({ channels, socialAccounts }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const accountMap = Object.fromEntries(socialAccounts.map((a) => [a.platform, a]));

  return (
    <div className="space-y-6 pt-4">
      {/* Social Accounts */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-purple-600" />
          <h3 className="font-semibold">Comptes sociaux</h3>
          <span className="text-xs text-muted-foreground">(connexion API)</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {SOCIAL_PLATFORMS.map((platform) => (
            <SocialAccountCard
              key={platform}
              platform={platform}
              account={accountMap[platform]}
            />
          ))}
        </div>
      </div>

      {/* Channels */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-blue-600" />
            <h3 className="font-semibold">Canaux de diffusion</h3>
            <Badge variant="secondary" className="text-xs">
              {channels.filter((c) => c.status === "active").length} actifs
            </Badge>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un canal
          </Button>
        </div>

        {channels.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <Radio className="mx-auto h-10 w-10 opacity-30 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Aucun canal configuré — ajoutez vos groupes WhatsApp, pages sociales, listes email...
              </p>
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un canal
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {channels.map((ch) => (
              <ChannelRow key={ch.id} channel={ch} />
            ))}
          </div>
        )}
      </div>

      <AddChannelDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
