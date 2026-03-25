import Link from "next/link";
import { FileText, ExternalLink, Eye } from "lucide-react";

import { getQuotesOverview } from "@/lib/actions/quote.actions";
import { KpiCard, KpiGrid } from "@/components/shared/kpi-card";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QuotePdfButton } from "@/components/quotes/quote-pdf-button";
import { QuotePaymentActions } from "@/components/quotes/quote-payment-actions";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    approval?: string;
  }>;
};

export const metadata = {
  title: "Devis | Horion ERP",
  description: "Vue centralisee de tous les devis Horion",
};

export default async function QuotesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const result = await getQuotesOverview({
    q: params.q,
    status: params.status,
    approval: params.approval,
  });

  if (result.error) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
        {result.error}
      </div>
    );
  }

  const { quotes, kpis, filters } = result.data!;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Devis"
        description="Rebrique centralisee pour consulter les devis commandes et sourcing indicatif."
      />

      <Card className="border-0 bg-muted/30">
        <CardContent className="pt-6">
          <form className="grid gap-3 md:grid-cols-[1.5fr_220px_220px_auto]">
            <Input
              name="q"
              defaultValue={filters.q}
              placeholder="Rechercher commande, client, email, signataire..."
            />
            <NativeSelect
              name="status"
              defaultValue={filters.status}
              options={[
                { value: "all", label: "Tous statuts" },
                { value: "DRAFT", label: "Brouillon" },
                { value: "SENT", label: "Envoye" },
                { value: "ACCEPTED", label: "Accepte" },
                { value: "REJECTED", label: "Refuse" },
                { value: "EXPIRED", label: "Expire" },
              ]}
            />
            <NativeSelect
              name="approval"
              defaultValue={filters.approval}
              options={[
                { value: "all", label: "Toutes validations" },
                { value: "PENDING", label: "Approval pending" },
                { value: "APPROVED", label: "Approval approuve" },
                { value: "REJECTED", label: "Approval rejete" },
              ]}
            />
            <Button type="submit">Filtrer</Button>
          </form>
        </CardContent>
      </Card>

      <KpiGrid cols={6}>
        <KpiCard label="Actifs" value={kpis.totalQuotes} icon={<FileText className="h-4 w-4 text-muted-foreground" />} />
        <KpiCard label="Brouillons" value={kpis.draft} />
        <KpiCard label="Envoyes" value={kpis.sent} />
        <KpiCard label="Acceptes" value={kpis.accepted} variant={kpis.accepted > 0 ? "success" : "default"} />
        <KpiCard label="A approuver" value={kpis.awaitingApproval} variant={kpis.awaitingApproval > 0 ? "warning" : "default"} />
        <KpiCard label="Valeur XAF" value={formatMoney(kpis.totalValueXaf, "XAF")} />
      </KpiGrid>

      <Card className="border-0 bg-muted/30">
        <CardContent className="pt-6">
          <div className="rounded-lg border bg-background/80">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Devis</TableHead>
                  <TableHead>Commande / client</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Paiement</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Envoi / signature</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-sm text-muted-foreground">
                      Aucun devis trouve.
                    </TableCell>
                  </TableRow>
                ) : (
                  quotes.map((quote) => (
                    <TableRow key={quote.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">
                            {quote.order.orderNumber} - V{quote.version}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Cree le {formatDate(quote.createdAt)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Validite : {quote.validUntil ? formatDate(quote.validUntil) : "non definie"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{quote.order.contact?.name || "Client non renseigne"}</div>
                          <div className="text-xs text-muted-foreground">{quote.order.orderNumber}</div>
                          <div className="text-xs text-muted-foreground">
                            {quote.sentByEmailTo || quote.order.contact?.email || quote.order.contact?.phone || "-"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant="outline">{normalizeSourceLabel(quote.source)}</Badge>
                          <div className="text-xs text-muted-foreground">
                            {quote.lineCount ? `${quote.lineCount} ligne(s)` : "Sans detail"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Badge className={statusClassName(quote.status)}>
                            {statusLabel(quote.status)}
                          </Badge>
                          <div>
                            <Badge variant={quote.approvalStatus === "APPROVED" ? "default" : quote.approvalStatus === "REJECTED" ? "destructive" : "secondary"}>
                              Approval {approvalLabel(quote.approvalStatus)}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Badge className={paymentStatusClassName(quote.paymentStatus)}>
                            {paymentStatusLabel(quote.paymentStatus)}
                          </Badge>
                          {quote.latestPayment ? (
                            <div className="space-y-1 text-xs text-muted-foreground">
                              <div>Ref: {quote.latestPayment.reference || "-"}</div>
                              <div>Methode: {quote.latestPayment.method || quote.paymentMethod || "-"}</div>
                              <div>Statut: {paymentRecordStatusLabel(quote.latestPayment.status)}</div>
                              <div>
                                Recu:{" "}
                                {formatDate(quote.latestPayment.confirmedAt || quote.latestPayment.createdAt, true)}
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              {quote.paymentExpiry ? `Expire le ${formatDate(quote.paymentExpiry, true)}` : "Aucune soumission"}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{formatMoney(Number(quote.total), quote.currency)}</div>
                          <div className="text-xs text-muted-foreground">
                            Marchandise {formatMoney(Number(quote.merchandiseTotal), quote.currency)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Logistique {formatMoney(Number(quote.logisticsCost), quote.currency)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div>Envoye : {quote.sentAt ? formatDate(quote.sentAt, true) : "non"}</div>
                          <div>Email : {quote.sentByEmailAt ? formatDate(quote.sentByEmailAt, true) : "non"}</div>
                          <div>Signe : {quote.signedAt ? `${formatDate(quote.signedAt, true)}${quote.signedByName ? ` par ${quote.signedByName}` : ""}` : "non"}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-end gap-2">
                          {quote.paymentStatus === "SUBMITTED" &&
                          quote.latestPayment?.id &&
                          ["PENDING", "PROCESSING"].includes(quote.latestPayment.status) ? (
                            <QuotePaymentActions
                              quoteId={quote.id}
                              paymentReference={quote.latestPayment.reference || null}
                            />
                          ) : null}
                          <div className="flex justify-end gap-2">
                            <QuotePdfButton quoteId={quote.id} orderNumber={quote.order.orderNumber} />
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/orders/${quote.order.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                Ouvrir
                              </Link>
                            </Button>
                            {quote.signatureToken ? (
                              <Button asChild variant="outline" size="sm">
                                <Link href={`/quote/${quote.signatureToken}`} target="_blank">
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  Lien
                                </Link>
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function NativeSelect({
  name,
  defaultValue,
  options,
}: {
  name: string;
  defaultValue?: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "XAF" ? 0 : 2,
  }).format(value || 0);
}

function formatDate(value: string | Date, withTime = false) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    ...(withTime ? { timeStyle: "short" as const } : {}),
  }).format(date);
}

function statusLabel(status: string) {
  switch (status) {
    case "DRAFT":
      return "Brouillon";
    case "SENT":
      return "Envoye";
    case "ACCEPTED":
      return "Accepte";
    case "REJECTED":
      return "Refuse";
    case "EXPIRED":
      return "Expire";
    default:
      return status;
  }
}

function approvalLabel(status: string) {
  switch (status) {
    case "PENDING":
      return "pending";
    case "APPROVED":
      return "approuve";
    case "REJECTED":
      return "rejete";
    default:
      return status;
  }
}

function normalizeSourceLabel(source: string) {
  if (source === "SOURCING_INDICATIF") return "Sourcing indicatif";
  if (source === "CRM_LEAD") return "CRM";
  return "Commande";
}

function statusClassName(status: string) {
  switch (status) {
    case "ACCEPTED":
      return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
    case "SENT":
      return "bg-blue-100 text-blue-700 hover:bg-blue-100";
    case "REJECTED":
      return "bg-rose-100 text-rose-700 hover:bg-rose-100";
    case "EXPIRED":
      return "bg-amber-100 text-amber-700 hover:bg-amber-100";
    default:
      return "bg-muted text-foreground";
  }
}

function paymentStatusLabel(status?: string | null) {
  switch (status) {
    case "PAID":
      return "Paye";
    case "SUBMITTED":
      return "Soumis";
    case "EXPIRED":
      return "Expire";
    case "PENDING":
    case null:
    case undefined:
      return "En attente";
    default:
      return status;
  }
}

function paymentStatusClassName(status?: string | null) {
  switch (status) {
    case "PAID":
      return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
    case "SUBMITTED":
      return "bg-blue-100 text-blue-700 hover:bg-blue-100";
    case "EXPIRED":
      return "bg-amber-100 text-amber-700 hover:bg-amber-100";
    case "PENDING":
    case null:
    case undefined:
      return "bg-muted text-foreground";
    default:
      return "bg-muted text-foreground";
  }
}

function paymentRecordStatusLabel(status?: string | null) {
  switch (status) {
    case "CONFIRMED":
      return "Confirme";
    case "PROCESSING":
      return "En traitement";
    case "CANCELLED":
      return "Annule";
    case "FAILED":
      return "Echoue";
    case "PENDING":
    case null:
    case undefined:
      return "En attente";
    default:
      return status;
  }
}
