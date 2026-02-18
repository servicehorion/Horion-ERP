"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { selectSourcingSupplier } from "@/lib/actions/sourcing.actions";
import { Check, Star, Clock, Package, Loader2 } from "lucide-react";

interface Offer {
  id: string;
  supplierId: string;
  unitPrice: unknown;
  currency: string;
  moq: number | null;
  leadTimeDays: number | null;
  sampleAvailable: boolean;
  isSelected: boolean;
  notes: string | null;
  createdAt: string | Date;
  supplier: {
    id: string;
    name: string;
    country: string | null;
    rating: number;
  };
  product: { id: string; name: string } | null;
}

export function OfferComparisonTable({
  offers,
  sourcingCaseId,
  canSelect,
}: {
  offers: Offer[];
  sourcingCaseId: string;
  canSelect: boolean;
}) {
  const router = useRouter();
  const [selectingId, setSelectingId] = useState<string | null>(null);

  if (offers.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        <Package className="mx-auto h-8 w-8 opacity-30 mb-2" />
        Aucune offre reçue pour le moment
      </div>
    );
  }

  // Find best values for highlighting
  const prices = offers.map((o) => Number(o.unitPrice));
  const leadTimes = offers.filter((o) => o.leadTimeDays).map((o) => o.leadTimeDays!);
  const bestPrice = Math.min(...prices);
  const bestLeadTime = leadTimes.length > 0 ? Math.min(...leadTimes) : null;

  async function handleSelect(offer: Offer) {
    setSelectingId(offer.id);
    const result = await selectSourcingSupplier(sourcingCaseId, {
      supplierId: offer.supplierId,
      offerId: offer.id,
    });
    setSelectingId(null);
    if (result.error) {
      alert(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {offers.map((offer) => {
        const price = Number(offer.unitPrice);
        const isBestPrice = price === bestPrice;
        const isBestLead = offer.leadTimeDays != null && offer.leadTimeDays === bestLeadTime;

        return (
          <Card
            key={offer.id}
            className={`relative ${offer.isSelected ? "border-green-500 border-2 shadow-md" : ""}`}
          >
            {offer.isSelected && (
              <div className="absolute -top-2 -right-2 rounded-full bg-green-500 p-1">
                <Check className="h-3 w-3 text-white" />
              </div>
            )}
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="truncate">{offer.supplier.name}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                  <span className="text-xs">{offer.supplier.rating}</span>
                </div>
              </CardTitle>
              {offer.supplier.country && (
                <p className="text-xs text-muted-foreground">{offer.supplier.country}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Price */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Prix unitaire</span>
                <div className="flex items-center gap-1">
                  <span className={`font-bold ${isBestPrice ? "text-green-600" : ""}`}>
                    {price.toFixed(2)} {offer.currency}
                  </span>
                  {isBestPrice && offers.length > 1 && (
                    <Badge variant="secondary" className="bg-green-100 text-green-800 text-[10px]">
                      Meilleur
                    </Badge>
                  )}
                </div>
              </div>

              {/* MOQ */}
              {offer.moq != null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">MOQ</span>
                  <span className="text-sm font-medium">{offer.moq} unités</span>
                </div>
              )}

              {/* Lead time */}
              {offer.leadTimeDays != null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Délai
                  </span>
                  <div className="flex items-center gap-1">
                    <span className={`text-sm font-medium ${isBestLead ? "text-green-600" : ""}`}>
                      {offer.leadTimeDays}j
                    </span>
                    {isBestLead && offers.length > 1 && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800 text-[10px]">
                        Rapide
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Sample */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Échantillon</span>
                <Badge variant={offer.sampleAvailable ? "default" : "secondary"}>
                  {offer.sampleAvailable ? "Disponible" : "Non"}
                </Badge>
              </div>

              {/* Notes */}
              {offer.notes && (
                <p className="text-xs text-muted-foreground border-t pt-2">{offer.notes}</p>
              )}

              {/* Select button */}
              {canSelect && !offer.isSelected && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-2"
                  onClick={() => handleSelect(offer)}
                  disabled={selectingId === offer.id}
                >
                  {selectingId === offer.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Sélectionner ce fournisseur
                </Button>
              )}

              {offer.isSelected && (
                <div className="text-center text-sm text-green-600 font-medium mt-2">
                  Fournisseur sélectionné
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
