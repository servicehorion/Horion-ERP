import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { getMargins, getAverageMargin } from "@/lib/actions/payment.actions";
import { formatCurrency } from "@/config/currencies";

export const metadata = { title: "Marges | Horion ERP" };

export default async function MarginsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/finance"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Marges</h1>
          <p className="text-muted-foreground">Analyse des marges par commande</p>
        </div>
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <MarginsContent />
      </Suspense>
    </div>
  );
}

async function MarginsContent() {
  const [marginsResult, avgResult] = await Promise.all([
    getMargins({}),
    getAverageMargin(),
  ]);

  const reports = marginsResult.data || [];
  const avg = avgResult.data || { avgMarginPercent: 0, totalGrossMargin: 0, totalRevenue: 0, count: 0 };

  return (
    <>
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Marge moyenne</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avg.avgMarginPercent.toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Marge brute totale</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(avg.totalGrossMargin, "XAF")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">CA total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(avg.totalRevenue, "XAF")}</div>
          </CardContent>
        </Card>
      </div>

      {/* Margins Table */}
      {reports.length === 0 ? (
        <EmptyState
          title="Aucune marge calculée"
          description="Les marges seront calculées automatiquement quand des paiements seront confirmés"
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Commande</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">COGS</TableHead>
                <TableHead className="text-right">Marge brute</TableHead>
                <TableHead className="text-right">Marge %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => {
                const marginPercent = Number(report.marginPercent);
                return (
                  <TableRow key={report.id}>
                    <TableCell>
                      <Link href={`/orders/${report.orderId}`} className="font-medium text-primary hover:underline">
                        {report.order.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{report.order.contact.name}</TableCell>
                    <TableCell>
                      <StatusBadge status={report.order.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <CurrencyDisplay amount={Number(report.revenue)} currency="XAF" />
                    </TableCell>
                    <TableCell className="text-right">
                      <CurrencyDisplay amount={Number(report.cogs)} currency="XAF" />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <CurrencyDisplay amount={Number(report.grossMargin)} currency="XAF" />
                    </TableCell>
                    <TableCell className={`text-right font-bold ${marginPercent >= 15 ? "text-green-600" : marginPercent >= 0 ? "text-yellow-600" : "text-red-600"}`}>
                      {marginPercent.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
