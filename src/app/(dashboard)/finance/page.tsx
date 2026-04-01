import Link from "next/link";
import {
  ArrowRightLeft,
  BadgeDollarSign,
  BarChart3,
  CheckCircle2,
  CreditCard,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { formatCurrency } from "@/config/currencies";
import { getSession } from "@/lib/session";
import { checkPermission } from "@/lib/permissions";
import { FinanceOperationsService } from "@/lib/services/finance-operations.service";

export const metadata = { title: "Finance Operations | Horion ERP" };

const QUICK_LINKS = [
  { href: "/finance/treasury", label: "Tresorerie & Wallets", icon: Wallet },
  { href: "/finance/payments", label: "Paiements", icon: CreditCard },
  { href: "/finance/approvals", label: "Approvals", icon: ShieldCheck },
  { href: "/finance/invoices", label: "Facturation", icon: BadgeDollarSign },
  { href: "/finance/margins", label: "Marges", icon: BarChart3 },
  { href: "/finance/statements", label: "Etats financiers", icon: ArrowRightLeft },
  { href: "/finance/archive", label: "Archive / Future", icon: ArrowRightLeft },
];

export default async function FinanceDashboardPage() {
  const user = await getSession();
  checkPermission(user.role, "finance.view");

  const snapshot = await FinanceOperationsService.getOperationsSnapshot(user.tenantId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance Operations"
        description="Pilotage cash-first par commande. Les modules comptables lourds sont sortis du coeur de navigation."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cash disponible</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrency(snapshot.cash.operatingCash, "XAF")}</div>
            <p className="mt-1 text-xs text-muted-foreground">Wallets et banques operationnelles en XAF.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cash Chine</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrency(snapshot.cash.chinaCash, "XAF")}</div>
            <p className="mt-1 text-xs text-muted-foreground">Pouvoir d'achat CNY converti en XAF.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cash bloque</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrency(snapshot.cash.lockedCash, "XAF")}</div>
            <p className="mt-1 text-xs text-muted-foreground">Encaissements confirms pas encore rapproches banque.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Marge nette</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrency(snapshot.operationalPnl.netMargin, "XAF")}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {snapshot.operationalPnl.netMarginPercent.toFixed(1)}% sur les flux confirmes.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Modules coeur</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {QUICK_LINKS.map((item) => {
            const Icon = item.icon;
            return (
              <Button key={item.href} variant="outline" size="sm" asChild>
                <Link href={item.href}>
                  <Icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Link>
              </Button>
            );
          })}
        </CardContent>
      </Card>

      {/* Cash réel vs attendu cockpit */}
      <Card>
        <CardHeader>
          <CardTitle>Cash réel vs attendu</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="rounded-lg border bg-green-50 p-3 space-y-1 dark:bg-green-950/30">
              <p className="text-xs font-medium uppercase tracking-wide text-green-700 dark:text-green-400">
                Cash confirmé
              </p>
              <p className="text-xl font-semibold text-green-700 dark:text-green-300">
                {formatCurrency(snapshot.cashReality.confirmedCashXAF, "XAF")}
              </p>
              <p className="text-xs text-muted-foreground">Paiements CONFIRMED reçus</p>
            </div>
            <div className="rounded-lg border bg-blue-50 p-3 space-y-1 dark:bg-blue-950/30">
              <p className="text-xs font-medium uppercase tracking-wide text-blue-700 dark:text-blue-400">
                Cash en attente
              </p>
              <p className="text-xl font-semibold text-blue-700 dark:text-blue-300">
                {formatCurrency(snapshot.cashReality.pendingCashXAF, "XAF")}
              </p>
              <p className="text-xs text-muted-foreground">Preuves uploadées / en cours</p>
            </div>
            <div className="rounded-lg border bg-amber-50 p-3 space-y-1 dark:bg-amber-950/30">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
                Cash à risque
              </p>
              <p className="text-xl font-semibold text-amber-700 dark:text-amber-300">
                {formatCurrency(snapshot.cashReality.atRiskCashXAF, "XAF")}
              </p>
              <p className="text-xs text-muted-foreground">Litiges, expirés, échoués</p>
            </div>
            <div className="rounded-lg border bg-slate-50 p-3 space-y-1 dark:bg-slate-800/50">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-700 dark:text-slate-300">
                Total attendu
              </p>
              <p className="text-xl font-semibold">
                {formatCurrency(snapshot.cashReality.expectedTotalCashXAF, "XAF")}
              </p>
              <p className="text-xs text-muted-foreground">Confirmé + en attente</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>P&L operationnel</CardTitle>
            <Badge variant="secondary">Read-only</Badge>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Chiffre d'affaires brut</span>
              <span className="font-medium">{formatCurrency(snapshot.operationalPnl.grossRevenue, "XAF")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Achats Chine</span>
              <span className="font-medium text-red-600">-{formatCurrency(snapshot.operationalPnl.chinaPurchases, "XAF")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Frais logistiques</span>
              <span className="font-medium text-red-600">-{formatCurrency(snapshot.operationalPnl.shippingFees, "XAF")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Frais plateforme</span>
              <span className="font-medium text-red-600">-{formatCurrency(snapshot.operationalPnl.platformFees, "XAF")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Remboursements</span>
              <span className="font-medium text-red-600">-{formatCurrency(snapshot.operationalPnl.refunds, "XAF")}</span>
            </div>
            <div className="border-t pt-3 flex items-center justify-between text-base">
              <span className="font-semibold">Marge nette</span>
              <span className="font-semibold">
                {formatCurrency(snapshot.operationalPnl.netMargin, "XAF")}{" "}
                <span className="text-sm text-muted-foreground">
                  ({snapshot.operationalPnl.netMarginPercent.toFixed(1)}%)
                </span>
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Approvals & risques</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span>Demandes en attente</span>
              <Badge>{snapshot.approvals.pendingCount}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Cash-out a valider</span>
              <span className="font-medium">{formatCurrency(snapshot.approvals.pendingCashOutXAF, "XAF")}</span>
            </div>
            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              Les modules `Immobilisations`, `Fiscalite`, `Paie`, `Consolidation`, `Periodes` et `Journaux`
              restent accessibles hors navigation, mais ne pilotent plus l'operation Day 1.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Wallets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.wallets.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun wallet configure.</p>
            ) : (
              snapshot.wallets.map((wallet) => (
                <div key={wallet.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{wallet.label}</p>
                    <p className="text-xs text-muted-foreground">{wallet.currency}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{wallet.balance.toLocaleString("fr-FR")} {wallet.currency}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(wallet.balanceXAF, "XAF")}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Passifs operationnels</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Commandes clients non bouclees</span>
              <span className="font-medium">{formatCurrency(snapshot.balance.liabilitiesCustomerOrders, "XAF")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Dettes transitaires / partenaires</span>
              <span className="font-medium">{formatCurrency(snapshot.balance.liabilitiesPartnerPayables, "XAF")}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <span className="font-semibold">Position nette simplifiee</span>
              <span className="font-semibold">{formatCurrency(snapshot.balance.simplifiedEquity, "XAF")}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
