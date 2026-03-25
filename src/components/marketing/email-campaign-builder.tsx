"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Mail, Plus, Send, Trash2, BarChart3, Users } from "lucide-react";
import { toast } from "sonner";
import {
  createEmailCampaign,
  sendEmailCampaign,
  deleteEmailCampaign,
  type EmailCampaignItem,
} from "@/lib/actions/marketing.actions";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT:    { label: "Brouillon",  color: "bg-gray-100 text-gray-700" },
  SCHEDULED:{ label: "Planifiée", color: "bg-blue-100 text-blue-800" },
  SENDING:  { label: "En envoi",  color: "bg-amber-100 text-amber-800" },
  SENT:     { label: "Envoyée",   color: "bg-green-100 text-green-800" },
  CANCELLED:{ label: "Annulée",   color: "bg-red-100 text-red-700" },
};

const DEFAULT_HTML = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <h1 style="color:#1a1a1a">Bonjour,</h1>
  <p style="color:#555;line-height:1.6">Votre message ici...</p>
  <a href="#" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px">Voir l'offre</a>
  <p style="color:#999;font-size:12px;margin-top:32px">Horion ERP • Congo Brazzaville<br>Pour vous désabonner, cliquez ici.</p>
</div>`;

function CreateCampaignDialog({ onCreate }: { onCreate: (c: EmailCampaignItem) => void }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [fromName, setFromName] = useState("Horion ERP");
  const [htmlContent, setHtmlContent] = useState(DEFAULT_HTML);
  const [preview, setPreview] = useState(false);

  function handleCreate() {
    if (!name || !subject || !htmlContent) return;
    startTransition(async () => {
      const res = await createEmailCampaign({
        name, subject, fromName,
        htmlContent,
        textContent: htmlContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      });
      if (res.error) { toast.error(res.error); return; }
      toast.success("Campagne créée");
      onCreate(res.data!);
      setOpen(false);
      setName(""); setSubject(""); setHtmlContent(DEFAULT_HTML);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-1 h-4 w-4" />Nouvelle campagne</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Créer une campagne email</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nom de la campagne *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Promotion Juillet 2025" />
            </div>
            <div>
              <Label>Nom expéditeur</Label>
              <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Horion ERP" />
            </div>
          </div>
          <div>
            <Label>Objet de l'email *</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex: 🎉 Notre offre exclusive pour vous" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Contenu HTML *</Label>
              <Button variant="ghost" size="sm" onClick={() => setPreview(!preview)}>
                {preview ? "Éditer" : "Prévisualiser"}
              </Button>
            </div>
            {preview ? (
              <div
                className="border rounded p-4 min-h-40 bg-white text-sm"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />
            ) : (
              <Textarea
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
                rows={12}
                className="font-mono text-xs"
                placeholder="<div>Votre contenu HTML...</div>"
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            La campagne sera envoyée à tous les contacts avec un email. Assurez-vous que votre clé RESEND_API_KEY est configurée.
          </p>
          <Button onClick={handleCreate} disabled={pending || !name || !subject} className="w-full">
            {pending ? "Création..." : "Créer la campagne"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EmailCampaignBuilder({ initialCampaigns }: { initialCampaigns: EmailCampaignItem[] }) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [, startTransition] = useTransition();

  function handleSend(id: string) {
    startTransition(async () => {
      const confirmed = window.confirm("Envoyer cette campagne à tous les contacts ? Cette action est irréversible.");
      if (!confirmed) return;
      toast.loading("Envoi en cours...", { id: "send-campaign" });
      const res = await sendEmailCampaign(id);
      toast.dismiss("send-campaign");
      if (res.error) { toast.error(res.error); return; }
      toast.success(`Campagne envoyée: ${res.data!.sent} emails (${res.data!.errors} erreurs)`);
      setCampaigns((prev) => prev.map((c) => c.id === id ? { ...c, status: "SENT" } : c));
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteEmailCampaign(id);
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      toast.success("Campagne supprimée");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Campagnes Email</h2>
          <Badge variant="secondary">{campaigns.length}</Badge>
        </div>
        <CreateCampaignDialog onCreate={(c) => setCampaigns((prev) => [c, ...prev])} />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total campagnes", value: campaigns.length, icon: Mail },
          { label: "Envoyées", value: campaigns.filter((c) => c.status === "SENT").length, icon: Send },
          { label: "Destinataires total", value: campaigns.reduce((acc, c) => acc + c._count.recipients, 0), icon: Users },
          { label: "Taux de succès", value: `${campaigns.filter((c) => c.status === "SENT").length > 0 ? Math.round((campaigns.filter((c) => c.status === "SENT").length / campaigns.length) * 100) : 0}%`, icon: BarChart3 },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-3 flex items-center gap-2">
              <kpi.icon className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className="text-lg font-bold">{kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Campaigns list */}
      <div className="space-y-2">
        {campaigns.map((camp) => {
          const statusInfo = STATUS_MAP[camp.status] ?? { label: camp.status, color: "bg-gray-100 text-gray-700" };
          const stats = camp.stats as Record<string, number> | null;

          return (
            <Card key={camp.id}>
              <CardContent className="p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{camp.name}</p>
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Objet: {camp.subject}
                      {camp.fromName && ` • De: ${camp.fromName}`}
                    </p>
                    <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />{camp._count.recipients} destinataire(s)
                      </span>
                      {stats && camp.status === "SENT" && (
                        <>
                          <span>✅ {stats.sent ?? 0} envoyés</span>
                          {stats.errors > 0 && <span className="text-red-500">❌ {stats.errors} erreurs</span>}
                          {stats.opened > 0 && <span>👁 {stats.opened} ouvertures</span>}
                        </>
                      )}
                      <span>Créée le {new Date(camp.createdAt).toLocaleDateString("fr-FR")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {camp.status === "DRAFT" && (
                      <Button size="sm" onClick={() => handleSend(camp.id)}>
                        <Send className="mr-1 h-3.5 w-3.5" />Envoyer
                      </Button>
                    )}
                    {camp.status !== "SENT" && (
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(camp.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {campaigns.length === 0 && (
          <div className="rounded-lg border p-8 text-center text-muted-foreground">
            Aucune campagne email. Créez votre première campagne pour communiquer avec vos contacts.
          </div>
        )}
      </div>
    </div>
  );
}
