import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Archive Finance | Horion ERP" };

const ARCHIVED_MODULES = [
  { href: "/finance/assets", title: "Immobilisations", reason: "Hors coeur sourcing Day 1." },
  { href: "/finance/tax", title: "Fiscalite", reason: "A laisser au comptable humain pour le moment." },
  { href: "/finance/consolidation", title: "Consolidation", reason: "Pas utile sans multi-entites matures." },
  { href: "/finance/payroll", title: "Paie", reason: "Trop fragile pour du vibe coding en phase operations." },
  { href: "/finance/periods", title: "Periodes", reason: "Comptabilite froide, pas pilotage cash-first." },
  { href: "/finance/journals", title: "Journaux", reason: "Garde-fou comptable, plus noyau operationnel." },
  { href: "/finance/ledger", title: "Grand livre", reason: "Disponible au besoin, retiré du cœur produit." },
  { href: "/finance/forecast", title: "Forecast", reason: "A revisiter apres stabilisation du cash reel." },
  { href: "/finance/budgets", title: "Budgets", reason: "Secondaire tant que le flux transactionnel n'est pas totalement ferme." },
  { href: "/finance/cost-centers", title: "Centres de cout", reason: "Peu prioritaire pour Horion a ce stade." },
  { href: "/finance/cash-planning", title: "Cash Planning", reason: "A remettre apres reconciliation et spine transactionnel complets." },
];

export default function FinanceArchivePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Archive / Future"
        description="Modules finances gardes hors coeur produit pour eviter la dette d'orchestration."
      />

      <Card>
        <CardHeader>
          <CardTitle>Pourquoi cette archive existe</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Horion est pilote comme un OS de tresorerie operationnelle par commande.
            Ces modules restent accessibles, mais ne doivent plus imposer leur complexite au noyau ventes + sourcing + logistique.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ARCHIVED_MODULES.map((module) => (
          <Card key={module.href}>
            <CardHeader>
              <CardTitle className="text-base">{module.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{module.reason}</p>
              <Button variant="outline" size="sm" asChild>
                <Link href={module.href}>Ouvrir le module</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
