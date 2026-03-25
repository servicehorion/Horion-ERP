"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ShieldCheck, ShieldOff, Copy } from "lucide-react";

type Phase = "idle" | "setup" | "verify" | "backup" | "disable";

export function TwoFactorSetup({ twoFactorEnabled }: { twoFactorEnabled: boolean }) {
  const { update } = useSession();
  const [phase, setPhase] = useState<Phase>("idle");
  const [secret, setSecret] = useState("");
  const [otpauthUri, setOtpauthUri] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(twoFactorEnabled);

  async function startSetup() {
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Erreur"); return; }
    setSecret(data.secret);
    setOtpauthUri(data.otpauthUri);
    setPhase("setup");
  }

  async function verifyAndEnable() {
    if (!/^\d{6}$/.test(code)) { setError("Code à 6 chiffres requis"); return; }
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/2fa/enable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Code incorrect"); return; }
    setBackupCodes(data.backupCodes);
    setEnabled(true);
    setPhase("backup");
    await update();
  }

  async function disableTwoFactor() {
    if (!/^\d{6}$/.test(code)) { setError("Code à 6 chiffres requis"); return; }
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/2fa/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Code incorrect"); return; }
    setEnabled(false);
    setPhase("idle");
    await update();
  }

  function closeAndReset() {
    setPhase("idle");
    setCode("");
    setSecret("");
    setOtpauthUri("");
    setBackupCodes([]);
    setError("");
  }

  return (
    <div className="flex items-center justify-between py-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2 font-medium">
          {enabled ? (
            <ShieldCheck className="h-4 w-4 text-green-500" />
          ) : (
            <ShieldOff className="h-4 w-4 text-muted-foreground" />
          )}
          Authentification à deux facteurs (2FA)
          <Badge variant={enabled ? "default" : "secondary"}>
            {enabled ? "Activé" : "Désactivé"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {enabled
            ? "Votre compte est protégé par TOTP. Chaque connexion nécessite un code de votre application d'authentification."
            : "Protégez votre compte en exigeant un code TOTP à chaque connexion (Google Authenticator, Authy, etc.)."}
        </p>
      </div>

      {enabled ? (
        <Button variant="outline" size="sm" onClick={() => { setPhase("disable"); setCode(""); setError(""); }}>
          Désactiver
        </Button>
      ) : (
        <Button size="sm" onClick={startSetup} disabled={loading}>
          {loading ? "..." : "Activer"}
        </Button>
      )}

      {/* Setup dialog */}
      <Dialog open={phase === "setup"} onOpenChange={(o) => !o && closeAndReset()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurer le 2FA</DialogTitle>
            <DialogDescription>
              Scannez le QR code avec Google Authenticator, Authy ou toute autre app TOTP,
              puis entrez le code généré pour confirmer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-4 text-center">
              <p className="text-xs text-muted-foreground mb-2">Clé secrète (saisie manuelle)</p>
              <div className="flex items-center gap-2 justify-center">
                <code className="text-sm font-mono break-all">{secret}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => navigator.clipboard.writeText(secret)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <a
                href={otpauthUri}
                className="mt-2 inline-block text-xs text-primary underline"
                target="_blank"
                rel="noreferrer"
              >
                Ouvrir dans l'application
              </a>
            </div>
            <div className="space-y-2">
              <Label>Code de vérification</Label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              className="w-full"
              onClick={verifyAndEnable}
              disabled={loading || code.length !== 6}
            >
              {loading ? "Vérification..." : "Activer le 2FA"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Backup codes dialog */}
      <Dialog open={phase === "backup"} onOpenChange={(o) => !o && closeAndReset()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>2FA activé — Codes de secours</DialogTitle>
            <DialogDescription>
              Conservez ces codes en lieu sûr. Chaque code est à usage unique et vous permet
              de vous connecter si vous perdez accès à votre application d'authentification.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {backupCodes.map((c) => (
              <code key={c} className="rounded bg-muted px-3 py-1 text-sm font-mono text-center">
                {c}
              </code>
            ))}
          </div>
          <Button
            variant="outline"
            onClick={() => navigator.clipboard.writeText(backupCodes.join("\n"))}
          >
            <Copy className="mr-2 h-4 w-4" /> Copier tous les codes
          </Button>
          <Button onClick={closeAndReset}>J'ai sauvegardé mes codes</Button>
        </DialogContent>
      </Dialog>

      {/* Disable dialog */}
      <Dialog open={phase === "disable"} onOpenChange={(o) => !o && closeAndReset()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Désactiver le 2FA</DialogTitle>
            <DialogDescription>
              Entrez le code de votre application d'authentification pour confirmer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Code de vérification</Label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              variant="destructive"
              className="w-full"
              onClick={disableTwoFactor}
              disabled={loading || code.length !== 6}
            >
              {loading ? "Désactivation..." : "Désactiver le 2FA"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
