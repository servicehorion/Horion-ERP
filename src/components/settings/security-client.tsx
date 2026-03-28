"use client";

import { Lock, Shield, LogIn, LogOut, AlertTriangle, CheckCircle2, Monitor } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard, KpiGrid } from "@/components/shared/kpi-card";

type LoginEvent = {
  id: string;
  action: string;
  createdAt: Date;
  ipAddress: string | null;
  userId: string | null;
  user: { name: string; email: string } | null;
};

type Props = {
  currentUserId: string;
  recentLogins: LoginEvent[];
  totpEnabled: boolean;
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  "user.login": <LogIn className="h-3.5 w-3.5 text-green-500" />,
  "user.login_failed": <AlertTriangle className="h-3.5 w-3.5 text-red-500" />,
  "user.logout": <LogOut className="h-3.5 w-3.5 text-muted-foreground" />,
};

const ACTION_LABELS: Record<string, string> = {
  "user.login": "Connexion réussie",
  "user.login_failed": "Échec de connexion",
  "user.logout": "Déconnexion",
};

function formatDateTime(d: Date) {
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SecurityClient({ currentUserId, recentLogins, totpEnabled }: Props) {
  const failedCount = recentLogins.filter((l) => l.action === "user.login_failed").length;
  const successCount = recentLogins.filter((l) => l.action === "user.login").length;
  const myLogins = recentLogins.filter((l) => l.userId === currentUserId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sécurité"
        description="Activité de connexion et état de la double authentification"
      />

      <KpiGrid cols={3}>
        <KpiCard
          label="Connexions réussies (récentes)"
          value={successCount}
          icon={<CheckCircle2 className="h-4 w-4 text-muted-foreground" />}
          variant="success"
        />
        <KpiCard
          label="Échecs de connexion"
          value={failedCount}
          icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
          variant={failedCount > 3 ? "danger" : failedCount > 0 ? "warning" : "default"}
          urgent={failedCount > 5}
        />
        <KpiCard
          label="Double authentification (2FA)"
          value={totpEnabled ? "Activé" : "Désactivé"}
          icon={<Shield className="h-4 w-4 text-muted-foreground" />}
          variant={totpEnabled ? "success" : "warning"}
        />
      </KpiGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 2FA Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4" /> Double authentification (TOTP)
            </CardTitle>
            <CardDescription>
              Renforcez la sécurité de votre compte avec une application d'authentification.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {totpEnabled ? (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">2FA activé</p>
                  <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                    Votre compte est protégé par une application TOTP (Google Authenticator, Authy…)
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800">
                  <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-orange-800 dark:text-orange-200">2FA non configuré</p>
                    <p className="text-xs text-orange-700 dark:text-orange-300 mt-0.5">
                      Activez la double authentification pour sécuriser davantage votre accès.
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  La configuration 2FA se fait lors de la connexion. Contactez votre administrateur pour l'activer sur votre compte.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Monitor className="h-4 w-4" /> Mes connexions récentes
            </CardTitle>
            <CardDescription>Historique de vos 10 dernières sessions</CardDescription>
          </CardHeader>
          <CardContent>
            {myLogins.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun historique de connexion
              </p>
            ) : (
              <div className="space-y-2">
                {myLogins.slice(0, 10).map((event) => (
                  <div key={event.id} className="flex items-center gap-3 text-sm py-1.5 border-b last:border-b-0">
                    {ACTION_ICONS[event.action] ?? <LogIn className="h-3.5 w-3.5" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">
                        {ACTION_LABELS[event.action] ?? event.action}
                      </p>
                      {event.ipAddress && (
                        <p className="text-xs text-muted-foreground font-mono">{event.ipAddress}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(event.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* All tenant logins */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{"Activité de connexion — toute l'équipe"}</CardTitle>
          <CardDescription>{"Les 20 derniers événements d'authentification du tenant"}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Événement</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentLogins.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    Aucun événement de connexion enregistré
                  </TableCell>
                </TableRow>
              ) : (
                recentLogins.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(event.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {event.user ? (
                        <div>
                          <p className="font-medium">{event.user.name}</p>
                          <p className="text-xs text-muted-foreground">{event.user.email}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">Inconnu</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`text-xs flex items-center gap-1 w-fit ${
                          event.action === "user.login"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-100"
                            : event.action === "user.login_failed"
                            ? "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-100"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-200"
                        }`}
                      >
                        {ACTION_ICONS[event.action]}
                        {ACTION_LABELS[event.action] ?? event.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {event.ipAddress ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
