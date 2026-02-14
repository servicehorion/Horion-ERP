import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { getPayments } from "@/lib/actions/payment.actions";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Paiements | Horion ERP" };

const TYPE_LABELS: Record<string, string> = {
  CLIENT_DEPOSIT: "Acompte client",
  CLIENT_BALANCE: "Solde client",
  SUPPLIER_PAYMENT: "Paiement fournisseur",
  FREIGHT_PAYMENT: "Fret",
  CUSTOMS_DUTY: "Droits de douane",
  QC_PAYMENT: "QC",
  COMMISSION: "Commission",
  REFUND: "Remboursement",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-800",
  PROCESSING: "bg-blue-100 text-blue-800",
  CONFIRMED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-200 text-gray-500",
  REFUNDED: "bg-orange-100 text-orange-800",
};

export default async function PaymentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/finance"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Paiements</h1>
          <p className="text-muted-foreground">Encaissements et décaissements</p>
        </div>
      </div>

      <Tabs defaultValue="all" className="space-y-6">
        <TabsList>
          <TabsTrigger value="all">Tous</TabsTrigger>
          <TabsTrigger value="INBOUND">Encaissements</TabsTrigger>
          <TabsTrigger value="OUTBOUND">Décaissements</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Suspense fallback={<TableSkeleton />}>
            <PaymentsList />
          </Suspense>
        </TabsContent>
        <TabsContent value="INBOUND">
          <Suspense fallback={<TableSkeleton />}>
            <PaymentsList direction="INBOUND" />
          </Suspense>
        </TabsContent>
        <TabsContent value="OUTBOUND">
          <Suspense fallback={<TableSkeleton />}>
            <PaymentsList direction="OUTBOUND" />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}

async function PaymentsList({ direction }: { direction?: string }) {
  const result = await getPayments({ direction });

  if (result.error) {
    return <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">{result.error}</div>;
  }

  const payments = result.data || [];

  if (payments.length === 0) {
    return (
      <EmptyState
        title="Aucun paiement"
        description={direction === "INBOUND" ? "Aucun encaissement" : direction === "OUTBOUND" ? "Aucun décaissement" : "Les paiements apparaîtront ici"}
      />
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Commande</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Direction</TableHead>
            <TableHead>Montant</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Méthode</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => (
            <TableRow key={payment.id}>
              <TableCell>
                <Link href={`/orders/${payment.orderId}`} className="font-medium text-primary hover:underline">
                  {payment.order.orderNumber}
                </Link>
                <p className="text-xs text-muted-foreground">{payment.order.contact.name}</p>
              </TableCell>
              <TableCell className="text-sm">
                {TYPE_LABELS[payment.type] || payment.type}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={payment.direction === "INBOUND" ? "text-green-700" : "text-red-700"}>
                  {payment.direction === "INBOUND" ? "Entrant" : "Sortant"}
                </Badge>
              </TableCell>
              <TableCell className="font-medium">
                <CurrencyDisplay amount={Number(payment.amountXAF)} currency="XAF" />
              </TableCell>
              <TableCell>
                <Badge className={STATUS_COLORS[payment.status] || ""}>
                  {payment.status}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {payment.method || "-"}
              </TableCell>
              <TableCell className="text-sm">
                {formatDate(payment.createdAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
