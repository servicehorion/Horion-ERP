import { Suspense } from "react";
import { ArrowLeft, CheckCircle2, Clock, Eye } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { ProofReviewList, WaitingList } from "@/components/finance/payment-proof-review";
import { getAgentComptablePayments, getPayments } from "@/lib/actions/payment.actions";
import { getPaymentMethodLabel } from "@/lib/payments/config";
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
  PENDING_PROOF: "bg-amber-100 text-amber-800",
  PROOF_UPLOADED: "bg-sky-100 text-sky-800",
  PROOF_REJECTED: "bg-rose-100 text-rose-800",
  CONFIRMED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-200 text-gray-500",
  EXPIRED: "bg-zinc-200 text-zinc-700",
  REFUNDED: "bg-orange-100 text-orange-800",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  PROCESSING: "Traitement",
  PENDING_PROOF: "Preuve attendue",
  PROOF_UPLOADED: "Preuve recue",
  PROOF_REJECTED: "Preuve rejetee",
  CONFIRMED: "Confirme",
  FAILED: "Echoue",
  CANCELLED: "Annule",
  EXPIRED: "Expire",
  REFUNDED: "Rembourse",
};

export default async function PaymentsPage() {
  const agentRes = await getAgentComptablePayments();
  const agent = agentRes.data ?? { toReview: [], waiting: [], secured: [] };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/finance">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Paiements</h1>
          <p className="text-muted-foreground">Encaissements et decaissements</p>
        </div>
      </div>

      <Tabs defaultValue="to-review" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="to-review" className="gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            Preuves a verifier
            {agent.toReview.length > 0 && (
              <Badge className="ml-1 h-5 rounded-full bg-sky-600 px-1.5 text-xs text-white">
                {agent.toReview.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="waiting" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            En attente
            {agent.waiting.length > 0 && (
              <Badge className="ml-1 h-5 rounded-full bg-amber-500 px-1.5 text-xs text-white">
                {agent.waiting.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="secured" className="gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Fonds securises
          </TabsTrigger>
          <TabsTrigger value="all">Tous</TabsTrigger>
          <TabsTrigger value="INBOUND">Encaissements</TabsTrigger>
          <TabsTrigger value="OUTBOUND">Decaissements</TabsTrigger>
        </TabsList>

        <TabsContent value="to-review">
          <ProofReviewList payments={agent.toReview as any} />
        </TabsContent>

        <TabsContent value="waiting">
          <WaitingList payments={agent.waiting as any} />
        </TabsContent>

        <TabsContent value="secured">
          {agent.secured.length === 0 ? (
            <EmptyState
              title="Aucun fonds securise"
              description="Les paiements confirmes apparaitront ici."
            />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Commande</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Methode</TableHead>
                    <TableHead>Confirme le</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agent.secured.map((payment: any) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <Link href={`/orders/${payment.orderId}`} className="font-medium text-primary hover:underline">
                          {payment.order.orderNumber}
                        </Link>
                        <p className="text-xs text-muted-foreground">{payment.order.contact?.name ?? "-"}</p>
                      </TableCell>
                      <TableCell className="font-medium">
                        <CurrencyDisplay amount={Number(payment.amountXAF)} currency="XAF" />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {getPaymentMethodLabel(payment.method) ?? "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {payment.confirmedAt ? formatDate(payment.confirmedAt) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="all">
          <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Chargement...</div>}>
            <PaymentsList />
          </Suspense>
        </TabsContent>
        <TabsContent value="INBOUND">
          <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Chargement...</div>}>
            <PaymentsList direction="INBOUND" />
          </Suspense>
        </TabsContent>
        <TabsContent value="OUTBOUND">
          <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Chargement...</div>}>
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
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
        {result.error}
      </div>
    );
  }

  const payments = result.data || [];
  if (payments.length === 0) {
    return (
      <EmptyState
        title="Aucun paiement"
        description={
          direction === "INBOUND"
            ? "Aucun encaissement"
            : direction === "OUTBOUND"
              ? "Aucun decaissement"
              : "Les paiements apparaitront ici"
        }
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
            <TableHead>Methode</TableHead>
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
              <TableCell className="text-sm">{TYPE_LABELS[payment.type] || payment.type}</TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={payment.direction === "INBOUND" ? "text-green-700" : "text-red-700"}
                >
                  {payment.direction === "INBOUND" ? "Entrant" : "Sortant"}
                </Badge>
              </TableCell>
              <TableCell className="font-medium">
                <CurrencyDisplay amount={Number(payment.amountXAF)} currency="XAF" />
              </TableCell>
              <TableCell>
                <Badge className={STATUS_COLORS[payment.status] || ""}>
                  {STATUS_LABELS[payment.status] || payment.status}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {getPaymentMethodLabel(payment.method) || "-"}
              </TableCell>
              <TableCell className="text-sm">{formatDate(payment.createdAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
