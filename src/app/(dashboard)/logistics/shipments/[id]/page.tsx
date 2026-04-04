import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  FileText,
  Package,
  Route,
  ShieldCheck,
  Truck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import { SHIPMENT_STATUS_LABELS } from "@/lib/services/logistics-governance.service";
import {
  ShipmentDetailProjectionService,
  type ShipmentDetailProjection,
} from "@/lib/services/shipment-detail-projection.service";

export const metadata = {
  title: "Dossier shipment | Horion ERP",
  description: "Lecture detaillee d'une expedition, de sa douane et de sa structure logistique",
};

function formatDate(value?: Date | string | null) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString("fr-FR");
}

function formatMoney(amount?: number | null, currency = "USD") {
  if (amount == null) return "-";
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function toneClass(value: string) {
  switch (value) {
    case "BLOCKED":
    case "AT_RISK":
    case "HIGH":
      return "bg-red-100 text-red-700";
    case "WATCH":
    case "MEDIUM":
    case "STALE":
      return "bg-amber-100 text-amber-700";
    case "LIVE":
    case "LOW":
    case "STABLE":
    case "CLEARED":
      return "bg-green-100 text-green-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function KpiCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-semibold">{value}</p>
        {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
      </CardContent>
    </Card>
  );
}

function WorkflowSection({ projection }: { projection: ShipmentDetailProjection }) {
  const workflow = projection.workflow;
  if (!workflow) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Route className="h-4 w-4" />
          Workflow Shipment-Centric
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={toneClass(workflow.shipmentHealth)}>{workflow.shipmentHealth}</Badge>
          <Badge className={toneClass(workflow.businessRisk)}>{workflow.businessRisk}</Badge>
          <Badge className={toneClass(workflow.trackingFreshness)}>{workflow.trackingFreshness}</Badge>
        </div>

        <div>
          <p className="text-sm font-medium">Prochaine action defendable</p>
          <p className="text-sm text-muted-foreground">{workflow.nextAction}</p>
        </div>

        {workflow.blockers.length > 0 ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm font-medium text-red-700">Blocages actifs</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700">
              {workflow.blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            Aucune barriere critique immediate. Le shipment peut progresser via ses transitions autorisees.
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium">Transitions autorisees</p>
          {workflow.allowedTransitions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Shipment terminal ou sans transition supplementaire.</p>
          ) : (
            <div className="space-y-2">
              {workflow.allowedTransitions.map((transition) => (
                <div key={transition.status} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{transition.label}</Badge>
                      <span className="text-xs text-muted-foreground">{transition.status}</span>
                    </div>
                    <Badge className={transition.allowed ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}>
                      {transition.allowed ? "Pret" : "Bloque"}
                    </Badge>
                  </div>
                  {!transition.allowed && transition.blockers.length > 0 ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                      {transition.blockers.map((blocker) => (
                        <li key={blocker}>{blocker}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function ShipmentDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!hasPermission(session.role, "logistics.view")) notFound();

  const projection = await ShipmentDetailProjectionService.get(params.id, session.tenantId);
  if (!projection) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/logistics">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour logistique
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold">Shipment {projection.order.orderNumber}</h1>
              <Badge variant="outline">{projection.id.slice(-8)}</Badge>
              <Badge>{SHIPMENT_STATUS_LABELS[projection.shipment.status as keyof typeof SHIPMENT_STATUS_LABELS] ?? projection.shipment.status}</Badge>
              <Badge variant="secondary">{projection.shipment.mode}</Badge>
            </div>
            <p className="mt-1 text-muted-foreground">
              Dossier shipment dedie : douane canonique, batch canonique et structure partial / multi-leg / split.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/orders/${projection.order.id}`}>
              Voir commande
            </Link>
          </Button>
          {projection.shipment.trackingUrl ? (
            <Button size="sm" asChild>
              <Link href={projection.shipment.trackingUrl} target="_blank">
                Ouvrir tracking
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Shipment health" value={projection.workflow?.shipmentHealth ?? "-"} detail={projection.workflow?.nextAction} />
        <KpiCard label="Tracking freshness" value={projection.workflow?.trackingFreshness ?? "-"} detail={projection.shipment.trackingProvider || "Tracking manuel"} />
        <KpiCard label="Mode delivery" value={projection.deliveryModel.label} detail={`${projection.deliveryModel.scope} / ${projection.deliveryModel.role}`} />
        <KpiCard label="Cout detaille" value={formatMoney(projection.metrics.totalDetailedCost, projection.shipment.currency)} detail={`${projection.costLines.length} ligne(s) de cout`} />
        <KpiCard label="Douane canonique" value={projection.customs.canonical?.status ?? "Aucun dossier"} detail={`${projection.metrics.customsDocuments} document(s)`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <WorkflowSection projection={projection} />

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Identite & Route
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Client</span>
                <span className="font-medium">{projection.order.customerName || "-"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Trajet</span>
                <span className="font-medium">{projection.shipment.origin || "-"} <ArrowRight className="mx-1 inline h-3 w-3" /> {projection.shipment.destination || "-"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Tracking</span>
                <span className="font-medium">{projection.shipment.trackingNumber || projection.shipment.blNumber || projection.shipment.containerNumber || "-"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">ETD / ETA</span>
                <span className="text-right font-medium">
                  {formatDate(projection.shipment.estimatedDeparture)} / {formatDate(projection.shipment.estimatedArrival)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Boxes className="h-4 w-4" />
                Verite Batch
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {projection.batch.canonical ? (
                <div className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{projection.batch.canonical.batchNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        Canonique {projection.batch.canonical.type} · {projection.batch.canonical.status}
                      </p>
                    </div>
                    <Badge variant="secondary">{projection.batch.canonical.type}</Badge>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Aucun batch canonique rattache.</p>
              )}

              {projection.batch.legacyGroupage ? (
                <div className="rounded-lg border border-dashed p-3">
                  <p className="font-medium">Legacy groupage</p>
                  <p className="text-xs text-muted-foreground">
                    {projection.batch.legacyGroupage.name} · {projection.batch.legacyGroupage.status}
                  </p>
                </div>
              ) : null}

              {projection.batch.legacyConsolidation ? (
                <div className="rounded-lg border border-dashed p-3">
                  <p className="font-medium">Legacy consolidation</p>
                  <p className="text-xs text-muted-foreground">
                    {projection.batch.legacyConsolidation.batchNumber} · {projection.batch.legacyConsolidation.status}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Partial / Multi-Leg / Split
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Périmètre</p>
                <p className="mt-1 font-medium">{projection.deliveryModel.scope}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Rôle</p>
                <p className="mt-1 font-medium">{projection.deliveryModel.role}</p>
              </div>
            </div>

            {projection.deliveryModel.parentShipment ? (
              <div className="rounded-lg border p-3 text-sm">
                <p className="font-medium">Expédition parente</p>
                <p className="text-muted-foreground">
                  {projection.deliveryModel.parentShipment.orderNumber || projection.deliveryModel.parentShipment.id.slice(-8)} · {projection.deliveryModel.parentShipment.status}
                </p>
              </div>
            ) : null}

            {projection.deliveryModel.childShipments.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tronçon / split</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Périmètre</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projection.deliveryModel.childShipments.map((child) => (
                    <TableRow key={child.id}>
                      <TableCell className="font-medium">
                        {child.segmentLabel || `Segment ${child.segmentIndex ?? "?"}`}
                      </TableCell>
                      <TableCell>{child.role}</TableCell>
                      <TableCell>{child.scope}</TableCell>
                      <TableCell>{child.label}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Aucun segment enfant pour l’instant. Le schema est maintenant pret a supporter des legs et des remises partielles sans surcharger `OrderStatus`.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Verite Douane
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-lg border p-3">
              <p className="font-medium">Canonique shipment-level</p>
              <div className="mt-2 space-y-1 text-muted-foreground">
                <p>Statut : <span className="font-medium text-foreground">{projection.customs.canonical?.status || "-"}</span></p>
                <p>Declaration : <span className="font-medium text-foreground">{projection.customs.canonical?.declarationNum || "-"}</span></p>
                <p>Droits : <span className="font-medium text-foreground">{formatMoney(projection.customs.canonical?.dutyAmount, projection.customs.canonical?.dutyCurrency || "XAF")}</span></p>
                <p>Pieces : <span className="font-medium text-foreground">{projection.customs.canonical?.documentCount ?? 0}</span></p>
              </div>
            </div>

            <div className="rounded-lg border border-dashed p-3">
              <p className="font-medium">Resume order-level legacy</p>
              <div className="mt-2 space-y-1 text-muted-foreground">
                <p>Statut : <span className="font-medium text-foreground">{projection.customs.orderSummary?.status || "-"}</span></p>
                <p>Declaration : <span className="font-medium text-foreground">{projection.customs.orderSummary?.declarationRef || "-"}</span></p>
                <p>Derniere sync : <span className="font-medium text-foreground">{formatDate(projection.customs.orderSummary?.lastSyncedAt)}</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Route className="h-4 w-4" />
              Suivi de trajet
            </CardTitle>
          </CardHeader>
          <CardContent>
            {projection.trackingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun événement de tracking enregistré.</p>
            ) : (
              <div className="space-y-3">
                {projection.trackingEvents.map((event) => (
                  <div key={event.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{event.event}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(event.occurredAt)}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {event.location || "Lieu non renseigne"}
                      {event.description ? ` · ${event.description}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Taches liees
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Ouvertes</p>
                  <p className="mt-1 text-lg font-semibold">{projection.tasks.open}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Bloquees</p>
                  <p className="mt-1 text-lg font-semibold">{projection.tasks.blocked}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Overdue</p>
                  <p className="mt-1 text-lg font-semibold">{projection.tasks.overdue}</p>
                </div>
              </div>
              {projection.tasks.items.length > 0 ? (
                <div className="space-y-2">
                  {projection.tasks.items.slice(0, 6).map((task) => (
                    <div key={task.id} className="rounded-lg border p-3">
                      <p className="font-medium">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {task.status} · échéance {formatDate(task.dueDate || task.slaDeadline)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Aucune tâche d'expédition active.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Incidents &amp; coûts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                {projection.metrics.unresolvedIncidents} incident(s) non resolu(s) · {projection.costLines.length} ligne(s) de cout detaillees
              </p>
              {projection.incidents.slice(0, 4).map((incident) => (
                <div key={incident.id} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{incident.type}</p>
                    <Badge className={toneClass(incident.severity)}>{incident.severity}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{incident.description}</p>
                </div>
              ))}
              {projection.incidents.length === 0 ? (
                <p className="text-muted-foreground">Aucun incident actif.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
