import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Package,
  Clock,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Search,
  FileText,
  Send,
  Inbox,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSourcingCaseById, getSuppliersForSourcing } from "@/lib/actions/sourcing.actions";
import { SourcingStatusBadge } from "@/components/sourcing/sourcing-status-badge";
import { SourcingStatusSelect } from "@/components/sourcing/sourcing-status-select";
import { OfferComparisonTable } from "@/components/sourcing/offer-comparison-table";
import { AddOfferForm } from "@/components/sourcing/add-offer-form";
import { NegotiationForm } from "@/components/sourcing/negotiation-form";
import { ConfirmSelectionButton } from "@/components/sourcing/confirm-selection-button";

export const metadata = { title: "Détail cas sourcing | Horion ERP" };

const PIPELINE_STEPS = [
  { status: "SEARCHING", label: "Recherche", icon: Search },
  { status: "OFFERS_RECEIVED", label: "Offres", icon: Inbox },
  { status: "NEGOTIATING", label: "Négo.", icon: MessageSquare },
  { status: "SELECTED", label: "Sélectionné", icon: CheckCircle2 },
  { status: "CONFIRMED", label: "Confirmé", icon: CheckCircle2 },
];

function getStepIndex(status: string) {
  if (status === "CANCELLED") return -1;
  return PIPELINE_STEPS.findIndex((s) => s.status === status);
}

export default async function SourcingCaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [caseResult, suppliersResult] = await Promise.all([
    getSourcingCaseById(id),
    getSuppliersForSourcing(),
  ]);

  if (caseResult.error || !caseResult.data) return notFound();

  const sc = caseResult.data;
  const suppliers = suppliersResult.data || [];
  const currentStep = getStepIndex(sc.status);
  const isCancelled = sc.status === "CANCELLED";
  const isConfirmed = sc.status === "CONFIRMED";
  const canAddOffer = !isConfirmed && !isCancelled;
  const canSelect =
    ["OFFERS_RECEIVED", "NEGOTIATING"].includes(sc.status) && sc.offers.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link
            href="/sourcing/cases"
            className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
          >
            <ArrowLeft className="h-3 w-3" />
            Retour aux cas
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Package className="h-7 w-7" />
            {sc.order.orderNumber}
          </h1>
          <p className="text-muted-foreground">{sc.requirement}</p>
        </div>
        <div className="flex items-center gap-2">
          {sc.status === "SELECTED" && <ConfirmSelectionButton caseId={sc.id} />}
          <SourcingStatusSelect caseId={sc.id} currentStatus={sc.status} />
        </div>
      </div>

      {/* Pipeline Progress */}
      {!isCancelled && (
        <div className="flex items-center gap-1">
          {PIPELINE_STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isDone = index < currentStep;
            return (
              <div key={step.status} className="flex items-center flex-1">
                <div
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium w-full justify-center transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isDone
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">{step.label}</span>
                </div>
                {index < PIPELINE_STEPS.length - 1 && (
                  <div
                    className={`h-0.5 w-2 shrink-0 ${
                      isDone ? "bg-green-500" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {isCancelled && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 p-4">
          <XCircle className="h-5 w-5 text-red-600" />
          <span className="font-medium text-red-600">Ce cas de sourcing a été annulé</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Info + Offers */}
        <div className="lg:col-span-2 space-y-6">
          {/* Case Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Informations du cas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Commande</p>
                  <Link
                    href={`/orders/${sc.order.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {sc.order.orderNumber}
                  </Link>
                </div>
                <div>
                  <p className="text-muted-foreground">Client</p>
                  <p className="font-medium">{sc.order.contact.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Budget</p>
                  <p className="font-medium">
                    {sc.budget
                      ? `${Number(sc.budget).toLocaleString("fr-FR")} ${sc.currency}`
                      : "Non défini"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Fournisseur sélectionné</p>
                  <p className="font-medium">
                    {sc.supplier ? (
                      <Link
                        href={`/catalog/suppliers/${sc.supplier.id}`}
                        className="text-primary hover:underline"
                      >
                        {sc.supplier.name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Aucun</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Créé le</p>
                  <p className="font-medium">
                    {new Date(sc.createdAt).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                {sc.selectedAt && (
                  <div>
                    <p className="text-muted-foreground">Sélectionné le</p>
                    <p className="font-medium">
                      {new Date(sc.selectedAt).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Offers Comparison */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Package className="h-5 w-5" />
                Comparaison des offres ({sc.offers.length})
              </h2>
              {canAddOffer && (
                <AddOfferForm sourcingCaseId={sc.id} suppliers={suppliers} />
              )}
            </div>
            <OfferComparisonTable
              offers={sc.offers}
              sourcingCaseId={sc.id}
              canSelect={canSelect}
            />
          </div>
        </div>

        {/* Right: Negotiation Timeline */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Négociations ({sc.negotiations.length})
          </h2>

          {canAddOffer && <NegotiationForm sourcingCaseId={sc.id} />}

          {sc.negotiations.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Aucun échange enregistré
            </div>
          ) : (
            <div className="space-y-3">
              {sc.negotiations.map((log) => {
                const isOutbound = log.direction === "OUTBOUND";
                return (
                  <div
                    key={log.id}
                    className={`rounded-lg border p-3 text-sm ${
                      isOutbound
                        ? "border-blue-200 bg-blue-50 dark:bg-blue-950/20"
                        : "border-green-200 bg-green-50 dark:bg-green-950/20"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {isOutbound ? (
                        <Send className="h-3 w-3 text-blue-600" />
                      ) : (
                        <Inbox className="h-3 w-3 text-green-600" />
                      )}
                      <span className="font-medium text-xs">
                        {isOutbound ? "Envoyé" : "Reçu"}
                      </span>
                      {log.channel && (
                        <Badge variant="secondary" className="text-[10px]">
                          {log.channel}
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {new Date(log.createdAt).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-muted-foreground whitespace-pre-line">{log.message}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
