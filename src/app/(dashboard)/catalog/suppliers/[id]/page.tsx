import {
  ArrowLeft,
  Phone,
  Mail,
  MessageCircle,
  MapPin,
  User,
  Factory,
  Clock,
  Package,
  ShieldCheck,
  AlertTriangle,
  Truck,
  FileText,
  Image as ImageIcon,
  Video,
  File,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { getSupplierById } from "@/lib/actions/catalog.actions";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Fiche fournisseur | Horion ERP" };

interface Props {
  params: Promise<{ id: string }>;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  TESTING: "bg-yellow-100 text-yellow-800",
  SUSPENDED: "bg-orange-100 text-orange-800",
  BLACKLIST: "bg-red-100 text-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actif",
  TESTING: "En test",
  SUSPENDED: "Suspendu",
  BLACKLIST: "Blacklisté",
};

const MEDIA_ICONS: Record<string, React.ReactNode> = {
  image: <ImageIcon className="h-5 w-5" />,
  video: <Video className="h-5 w-5" />,
  pdf: <FileText className="h-5 w-5" />,
  document: <File className="h-5 w-5" />,
};

export default async function SupplierDetailPage({ params }: Props) {
  const { id } = await params;
  const result = await getSupplierById(id);

  if (result.error || !result.data) notFound();

  const supplier = result.data;
  const negotiatedTerms =
    supplier.negotiatedTermsJson &&
    typeof supplier.negotiatedTermsJson === "object"
      ? (supplier.negotiatedTermsJson as Record<string, unknown>)
      : {};

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/catalog/suppliers">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{supplier.name}</h1>
          {supplier.category && (
            <p className="text-lg text-muted-foreground">
              {supplier.category}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className={STATUS_COLORS[supplier.status] || ""}
          >
            {STATUS_LABELS[supplier.status] || supplier.status}
          </Badge>
          {supplier.isVerified && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              Vérifié
            </Badge>
          )}
        </div>
      </div>

      {/* Score bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Score global</span>
            <div className="flex-1">
              <div className="h-3 w-full rounded-full bg-muted">
                <div
                  className="h-3 rounded-full bg-primary transition-all"
                  style={{ width: `${supplier.rating}%` }}
                />
              </div>
            </div>
            <span className="text-lg font-bold">{supplier.rating}/100</span>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Vue d&apos;ensemble</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="conditions">Conditions</TabsTrigger>
          <TabsTrigger value="orders">
            Commandes ({supplier._count.sourcingCases})
          </TabsTrigger>
          <TabsTrigger value="products">
            Produits ({supplier._count.supplierProducts})
          </TabsTrigger>
          <TabsTrigger value="media">
            Médias ({supplier._count.catalogMedia})
          </TabsTrigger>
        </TabsList>

        {/* Vue d'ensemble */}
        <TabsContent value="overview">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Identité */}
            <Card>
              <CardHeader>
                <CardTitle>Identité</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Factory className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Plateforme :</span>
                  {supplier.platform || "-"}
                </div>
                {supplier.city && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {supplier.city}, {supplier.country}
                  </div>
                )}
                {supplier.category && (
                  <div className="flex items-center gap-2 text-sm">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    {supplier.category}
                  </div>
                )}
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  Créé le {formatDate(supplier.createdAt)}
                </div>
              </CardContent>
            </Card>

            {/* Contacts */}
            <Card>
              <CardHeader>
                <CardTitle>Contacts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {supplier.contactName && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {supplier.contactName}
                  </div>
                )}
                {supplier.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {supplier.phone}
                  </div>
                )}
                {supplier.wechat && (
                  <div className="flex items-center gap-2 text-sm">
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    {supplier.wechat}
                  </div>
                )}
                {supplier.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {supplier.email}
                  </div>
                )}
                {!supplier.contactName &&
                  !supplier.phone &&
                  !supplier.wechat &&
                  !supplier.email && (
                    <p className="text-sm text-muted-foreground">
                      Aucun contact renseigné
                    </p>
                  )}
              </CardContent>
            </Card>

            {/* Capacités */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Capacités</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border p-3 text-center">
                    <Clock className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
                    <p className="text-xs text-muted-foreground">
                      Délai de production
                    </p>
                    <p className="text-lg font-semibold">
                      {supplier.leadTimeDays
                        ? `${supplier.leadTimeDays} jours`
                        : "-"}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <Package className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
                    <p className="text-xs text-muted-foreground">MOQ</p>
                    <p className="text-lg font-semibold">
                      {supplier.moq || "-"}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <FileText className="mx-auto h-5 w-5 text-muted-foreground mb-1" />
                    <p className="text-xs text-muted-foreground">
                      Conditions de paiement
                    </p>
                    <p className="text-lg font-semibold">
                      {supplier.paymentTerms || "-"}
                    </p>
                  </div>
                </div>
                {supplier.notes && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      {supplier.notes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance */}
        <TabsContent value="performance">
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Taux QC
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {supplier.qcPassRate
                    ? `${Number(supplier.qcPassRate)}%`
                    : "-"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Taux de passage QC
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Fiabilité logistique
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {supplier.logisticsReliability
                    ? `${Number(supplier.logisticsReliability)}%`
                    : "-"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Fiabilité des expéditions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Taux d&apos;incidents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {supplier.incidentRate
                    ? `${Number(supplier.incidentRate)}%`
                    : "-"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Incidents signalés
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Scores history */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Historique des scores</CardTitle>
            </CardHeader>
            <CardContent>
              {supplier.supplierScores.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun score enregistré
                </p>
              ) : (
                <div className="space-y-3">
                  {supplier.supplierScores.map((score) => (
                    <div
                      key={score.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium">{score.dimension}</p>
                        {score.notes && (
                          <p className="text-xs text-muted-foreground">
                            {score.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-16 rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full bg-primary"
                              style={{ width: `${score.score}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">
                            {score.score}/100
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(score.createdAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Conditions */}
        <TabsContent value="conditions">
          <Card>
            <CardHeader>
              <CardTitle>Conditions négociées</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(negotiatedTerms).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucune condition négociée enregistrée
                </p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(negotiatedTerms).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-start justify-between rounded-lg border p-3"
                    >
                      <span className="font-medium capitalize">
                        {key.replace(/_/g, " ")}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {typeof value === "object"
                          ? JSON.stringify(value)
                          : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Commandes (sourcing cases) */}
        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>Dossiers de sourcing</CardTitle>
            </CardHeader>
            <CardContent>
              {supplier.sourcingCases.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun dossier de sourcing
                </p>
              ) : (
                <div className="space-y-3">
                  {supplier.sourcingCases.map((sc) => (
                    <div
                      key={sc.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <Link
                          href={`/orders/${sc.orderId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {sc.order.orderNumber}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {sc.requirement}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary">{sc.status}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(sc.createdAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Produits */}
        <TabsContent value="products">
          <Card>
            <CardHeader>
              <CardTitle>Produits liés</CardTitle>
            </CardHeader>
            <CardContent>
              {supplier.supplierProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun produit lié
                </p>
              ) : (
                <div className="space-y-3">
                  {supplier.supplierProducts.map((sp) => (
                    <div
                      key={sp.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <Link
                          href={`/catalog/products/${sp.productId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {sp.product.name}
                        </Link>
                        {sp.isPrimary && (
                          <Badge
                            variant="secondary"
                            className="ml-2 bg-blue-100 text-blue-800"
                          >
                            Principal
                          </Badge>
                        )}
                        {sp.reliabilityNotes && (
                          <p className="text-xs text-muted-foreground">
                            {sp.reliabilityNotes}
                          </p>
                        )}
                      </div>
                      <div className="text-right text-sm">
                        {sp.priceMin && sp.priceMax ? (
                          <p>
                            {Number(sp.priceMin)} - {Number(sp.priceMax)}{" "}
                            {sp.currency}
                          </p>
                        ) : sp.priceMin ? (
                          <p>
                            {Number(sp.priceMin)} {sp.currency}
                          </p>
                        ) : null}
                        {sp.moq && (
                          <p className="text-xs text-muted-foreground">
                            MOQ: {sp.moq}
                          </p>
                        )}
                        {sp.leadTimeDays && (
                          <p className="text-xs text-muted-foreground">
                            {sp.leadTimeDays} jours
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Médias */}
        <TabsContent value="media">
          <Card>
            <CardHeader>
              <CardTitle>Médias et preuves</CardTitle>
            </CardHeader>
            <CardContent>
              {supplier.catalogMedia.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun média associé
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {supplier.catalogMedia.map((media) => (
                    <div
                      key={media.id}
                      className="rounded-lg border p-4 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {MEDIA_ICONS[media.type] || (
                            <File className="h-5 w-5" />
                          )}
                        </span>
                        <span className="text-sm font-medium truncate">
                          {media.filename || media.url}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {media.type}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {media.linkedEntityType}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(media.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
