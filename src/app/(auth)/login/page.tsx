"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Step = "credentials" | "totp";

function resolveAuthError(result: { error?: string | null; url?: string | null }) {
  const errorCode = (result.error ?? "").toLowerCase();
  const urlErrorParam = result.url
    ? new URL(result.url, window.location.origin).searchParams.get("error")?.toLowerCase() ?? ""
    : "";
  const combined = `${errorCode} ${urlErrorParam}`;

  return {
    isTwoFactorRequired: combined.includes("two_factor_required"),
    isInvalidTwoFactor: combined.includes("two_factor_invalid"),
    isUnavailableTwoFactor: combined.includes("two_factor_unavailable"),
    isInvalidCredentials:
      combined.includes("credentialssignin") ||
      combined.includes("credentials_signin") ||
      combined.includes("mot de passe incorrect") ||
      combined.includes("invalid credentials"),
    isServerError:
      combined.includes("callbackrouteerror") ||
      combined.includes("configuration") ||
      combined.includes("adaptererror") ||
      combined.includes("sessionerror") ||
      combined.includes("jwtsessionerror"),
  };
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [step, setStep] = useState<Step>("credentials");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (!result?.error) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    // NextAuth v5 can surface the custom CredentialsSignin code directly,
    // or as a URL-encoded ?error= param in result.url. We check both.
    const authError = resolveAuthError(result);

    if (authError.isTwoFactorRequired) {
      setStep("totp");
    } else if (authError.isUnavailableTwoFactor) {
      setError("La verification 2FA est indisponible pour ce compte. Contactez un administrateur.");
    } else if (authError.isServerError) {
      setError("Erreur serveur d'authentification. Reessayez.");
    } else if (authError.isInvalidCredentials) {
      setError("Email ou mot de passe incorrect");
    } else {
      setError("Email ou mot de passe incorrect");
    }
  }

  async function handleTotp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      totpCode,
      redirect: false,
    });

    setLoading(false);

    if (!result?.error) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    const authError = resolveAuthError(result);

    if (authError.isInvalidTwoFactor) {
      setError("Code incorrect ou expire. Reessayez.");
    } else if (authError.isUnavailableTwoFactor) {
      setError("La verification 2FA est indisponible pour ce compte. Contactez un administrateur.");
      setStep("credentials");
    } else if (authError.isServerError) {
      setError("Erreur serveur d'authentification. Reessayez.");
    } else {
      setError("Erreur d'authentification. Recommencez depuis le debut.");
      setStep("credentials");
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Connexion</CardTitle>
        <CardDescription>
          {step === "credentials"
            ? "Connectez-vous a votre espace"
            : "Entrez le code de votre application d'authentification"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === "credentials" ? (
          <form onSubmit={handleCredentials} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="vous@horion.co"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Connexion..." : "Se connecter"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleTotp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="totp">Code d'authentification (6 chiffres)</Label>
              <Input
                id="totp"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                placeholder="123456"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                autoFocus
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              type="submit"
              className="w-full"
              disabled={loading || totpCode.length !== 6}
            >
              {loading ? "Verification..." : "Verifier le code"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setStep("credentials");
                setError("");
                setTotpCode("");
              }}
            >
              Retour
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

