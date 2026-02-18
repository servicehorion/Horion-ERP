import Link from "next/link";
import {
  AlertTriangle,
  Shield,
  Star,
  Activity,
  Factory,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getSourcingDashboardIntelligence } from "@/lib/actions/supplier-intelligence.actions";
import { ExportSuppliersButton } from "@/components/sourcing/export-suppliers-button";

export const metadata = { title: "Sourcing Intelligence | Horion ERP" };

function getRiskColor(score: number) {
  if (score <= 30) return "text-green-600";
  if (score <= 60) return "text-yellow-600";
  return "text-red-600";
}

function getReliabilityColor(score: number) {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-blue-500";
  if (score >= 40) return "bg-yellow-500";
  return "bg-red-500";
}

function getReliabilityLabel(score: number) {
  if (score >= 80) return { label: "Excellent", color: "bg-green-100 text-green-800" };
  if (score >= 60) return { label: "Bon", color: "bg-blue-100 text-blue-800" };
  if (score >= 40) return { label: "Moyen", color: "bg-yellow-100 text-yellow-800" };
  return { label: "Faible", color: "bg-red-100 text-red-800" };
}

export default async function SourcingIntelligencePage() {
  const result = await getSourcingDashboardIntelligence();

  if (result.error || !result.data) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Sourcing Intelligence</h1>
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          Erreur lors du chargement des données.
        </div>
      </div>
    );
  }

  const { topSuppliers, highRiskSuppliers, atRiskSegments, strategicPartners, spendConcentration, stats } =
    result.data;
  const hasData = topSuppliers.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sourcing Intelligence</h1>
          <p className="text-muted-foreground">Vue 360° de votre base fournisseurs</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportSuppliersButton />
          <Link
            href="/sourcing/cases"
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Cas de sourcing →
          </Link>
          <Link
            href="/catalog/suppliers"
            className="text-sm text-primary hover:underline"
          >
            Gérer les fournisseurs →
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Fournisseurs actifs
            </CardTitle>
            <Factory className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalActiveSuppliers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Fiabilité moyenne
            </CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.avgReliability.toFixed(0)}/100
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Haut risque
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.highRiskCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Valeur en cours
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalOutstandingValue > 0
                ? `${(stats.totalOutstandingValue / 1000).toFixed(0)}K`
                : "0"}{" "}
              XAF
            </div>
          </CardContent>
        </Card>
      </div>

      {!hasData ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground space-y-3">
            <Activity className="mx-auto h-12 w-12 opacity-20" />
            <p className="font-medium">Aucune intelligence calculée</p>
            <p className="text-sm">
              Ouvrez une fiche fournisseur et cliquez sur &quot;Recalculer Intelligence&quot;
              pour alimenter ce tableau de bord.
            </p>
            <Link
              href="/catalog/suppliers"
              className="inline-block text-primary hover:underline text-sm"
            >
              Voir les fournisseurs →
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Supplier Ranking */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-600" />
                Classement par fiabilité
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topSuppliers.map((s, index) => {
                  const reliability = Number(s.reliabilityIndex);
                  const level = getReliabilityLabel(reliability);
                  return (
                    <div
                      key={s.supplierId}
                      className="flex items-center gap-4 rounded-lg border p-3"
                    >
                      <span className="text-lg font-bold text-muted-foreground w-6 shrink-0">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/catalog/suppliers/${s.supplierId}`}
                            className="font-medium text-primary hover:underline truncate"
                          >
                            {s.supplier.name}
                          </Link>
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {s.supplier.country}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Progress
                            value={reliability}
                            className={`h-1.5 flex-1 ${getReliabilityColor(reliability)}`}
                          />
                          <span className="text-xs text-muted-foreground shrink-0">
                            {reliability.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-muted-foreground">
                            OTD {Number(s.onTimeDeliveryRate).toFixed(0)}%
                          </p>
                          <p className="text-xs text-muted-foreground">
                            QC {Number(s.qualityScore).toFixed(0)}/100
                          </p>
                        </div>
                        <Badge variant="secondary" className={level.color}>
                          {level.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* High Risk Suppliers */}
          {highRiskSuppliers.length > 0 && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  Fournisseurs à haut risque
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {highRiskSuppliers.map((r) => (
                    <div
                      key={r.supplierId}
                      className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 dark:bg-red-950/20 p-3"
                    >
                      <div>
                        <Link
                          href={`/catalog/suppliers/${r.supplierId}`}
                          className="font-medium text-primary hover:underline text-sm"
                        >
                          {r.supplier.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{r.supplier.country}</p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-lg font-bold ${getRiskColor(r.globalRiskScore)}`}
                        >
                          {r.globalRiskScore}
                        </span>
                        <p className="text-xs text-muted-foreground">/100</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Strategic Partners */}
          {strategicPartners.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-purple-600" />
                  Partenaires stratégiques
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {strategicPartners.map((seg) => (
                    <div
                      key={seg.supplierId}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <Link
                        href={`/catalog/suppliers/${seg.supplierId}`}
                        className="font-medium text-primary hover:underline text-sm"
                      >
                        {seg.supplier.name}
                      </Link>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-12 rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: `${seg.supplier.rating}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {seg.supplier.rating}/100
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Spend Concentration */}
          {spendConcentration.length > 0 && (
            <Card className={strategicPartners.length === 0 && highRiskSuppliers.length === 0 ? "lg:col-span-2" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-orange-600" />
                  Concentration des achats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {spendConcentration.map((m) => {
                    const spend = Number(m.lifetimeSpend);
                    const concentration = Number(m.spendConcentration);
                    return (
                      <div key={m.supplierId} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <Link
                            href={`/catalog/suppliers/${m.supplierId}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {m.supplier.name}
                          </Link>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">
                              {(spend / 1000).toFixed(0)}K XAF
                            </span>
                            {concentration > 30 && (
                              <AlertCircle className="h-3 w-3 text-orange-600" />
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={Math.min(concentration, 100)}
                            className={`h-2 flex-1 ${
                              concentration > 30 ? "bg-orange-500" : "bg-blue-500"
                            }`}
                          />
                          <span className="text-xs text-muted-foreground shrink-0 w-10 text-right">
                            {concentration.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* AT_RISK Alerts */}
          {atRiskSegments.length > 0 && (
            <Card className="border-orange-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-600">
                  <AlertCircle className="h-5 w-5" />
                  Fournisseurs à surveiller
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {atRiskSegments.map((seg) => (
                    <div
                      key={seg.supplierId}
                      className="flex items-center justify-between rounded-lg border border-orange-100 bg-orange-50 dark:bg-orange-950/20 p-3"
                    >
                      <Link
                        href={`/catalog/suppliers/${seg.supplierId}`}
                        className="font-medium text-primary hover:underline text-sm"
                      >
                        {seg.supplier.name}
                      </Link>
                      <Badge
                        variant="secondary"
                        className="bg-orange-100 text-orange-800 text-xs"
                      >
                        À risque
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
