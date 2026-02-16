import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getOffers } from "@/lib/actions/catalog.actions";
import { formatDate } from "@/lib/utils";

export const metadata = {
  title: "Offres & Historique prix | Horion ERP",
};

export default async function OffersPage({
  searchParams,
}: {
  searchParams: Promise<{ sourceType?: string }>;
}) {
  const { sourceType } = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Offres & Historique des prix</h1>
        <p className="text-muted-foreground">
          Suivi des offres fournisseurs et évolution des prix
        </p>
      </div>

      <Tabs defaultValue={sourceType || "all"} className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">Toutes</TabsTrigger>
          <TabsTrigger value="sourcing">Sourcing</TabsTrigger>
          <TabsTrigger value="order">Commande</TabsTrigger>
          <TabsTrigger value="manual">Manuel</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Suspense fallback={<TableSkeleton />}>
            <OffersList />
          </Suspense>
        </TabsContent>
        <TabsContent value="sourcing">
          <Suspense fallback={<TableSkeleton />}>
            <OffersList sourceType="sourcing" />
          </Suspense>
        </TabsContent>
        <TabsContent value="order">
          <Suspense fallback={<TableSkeleton />}>
            <OffersList sourceType="order" />
          </Suspense>
        </TabsContent>
        <TabsContent value="manual">
          <Suspense fallback={<TableSkeleton />}>
            <OffersList sourceType="manual" />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}

const SOURCE_COLORS: Record<string, string> = {
  sourcing: "bg-blue-100 text-blue-800",
  order: "bg-green-100 text-green-800",
  manual: "bg-gray-100 text-gray-800",
};

const SOURCE_LABELS: Record<string, string> = {
  sourcing: "Sourcing",
  order: "Commande",
  manual: "Manuel",
};

async function OffersList({ sourceType }: { sourceType?: string } = {}) {
  const result = await getOffers(sourceType ? { sourceType } : {});

  if (result.error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
        {result.error}
      </div>
    );
  }

  const offers = result.data || [];

  if (offers.length === 0) {
    return (
      <EmptyState
        title="Aucune offre"
        description="Les offres fournisseurs apparaîtront ici"
      />
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produit</TableHead>
            <TableHead>Fournisseur</TableHead>
            <TableHead>Prix</TableHead>
            <TableHead>MOQ</TableHead>
            <TableHead>Délai</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Validité</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {offers.map((offer) => (
            <TableRow key={offer.id}>
              <TableCell className="font-medium">
                {(offer as any).product?.name || "-"}
              </TableCell>
              <TableCell>{offer.supplier.name}</TableCell>
              <TableCell>
                {Number(offer.unitPrice)} {offer.currency}
              </TableCell>
              <TableCell>{offer.moq ?? "-"}</TableCell>
              <TableCell>
                {offer.leadTimeDays ? `${offer.leadTimeDays} jours` : "-"}
              </TableCell>
              <TableCell>
                <Badge
                  variant="secondary"
                  className={SOURCE_COLORS[offer.sourceType] || ""}
                >
                  {SOURCE_LABELS[offer.sourceType] || offer.sourceType}
                </Badge>
              </TableCell>
              <TableCell className="text-xs">
                {formatDate(offer.validFrom)}
                {offer.validTo && ` - ${formatDate(offer.validTo)}`}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {formatDate(offer.createdAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
