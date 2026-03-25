import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getProductById, getCategories } from "@/lib/actions/catalog.actions";
import { ProductEditForm } from "@/components/catalog/product-edit-form";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const res = await getProductById(params.id);
  return { title: `Éditer ${res.data?.name || "produit"} | Horion ERP` };
}

export default async function ProductEditPage({ params }: { params: { id: string } }) {
  const [productRes, categoriesRes] = await Promise.all([
    getProductById(params.id),
    getCategories(),
  ]);

  if (!productRes.data) notFound();

  const p = productRes.data as any;
  const categories = (categoriesRes.data || []).map((c: any) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/catalog/products/${params.id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Éditer — {p.name}</h1>
          <p className="text-muted-foreground">Modifier les informations du produit</p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl">
        <ProductEditForm
          productId={params.id}
          categories={categories}
          defaultValues={{
            name: p.name,
            categoryId: p.categoryId ?? undefined,
            status: p.status,
            aliasesJson: Array.isArray(p.aliasesJson) ? p.aliasesJson : [],
            searchKeywordsJson: Array.isArray(p.searchKeywordsJson) ? p.searchKeywordsJson : [],
            matchingFingerprint: p.matchingFingerprint ?? undefined,
            moqMin: p.moqMin ?? undefined,
            priceMin: p.priceMin != null ? Number(p.priceMin) : undefined,
            priceMax: p.priceMax != null ? Number(p.priceMax) : undefined,
            priceCurrency: p.priceCurrency || "RMB",
            preferredPlatform: p.preferredPlatform ?? undefined,
            weightedAverageCost: p.weightedAverageCost != null ? Number(p.weightedAverageCost) : undefined,
            estimatedCost: p.estimatedCost != null ? Number(p.estimatedCost) : undefined,
            lastActualCost: p.lastActualCost != null ? Number(p.lastActualCost) : undefined,
            recommendedSellPrice: p.recommendedSellPrice != null ? Number(p.recommendedSellPrice) : undefined,
            averageRealityCoefficient:
              p.averageRealityCoefficient != null ? Number(p.averageRealityCoefficient) : undefined,
            savingsVsIndicatifPct:
              p.savingsVsIndicatifPct != null ? Number(p.savingsVsIndicatifPct) : undefined,
            priceVolatilityPct: p.priceVolatilityPct != null ? Number(p.priceVolatilityPct) : undefined,
            defaultRiskBufferPct:
              p.defaultRiskBufferPct != null ? Number(p.defaultRiskBufferPct) : undefined,
            defaultHiddenMarginPct:
              p.defaultHiddenMarginPct != null ? Number(p.defaultHiddenMarginPct) : undefined,
            historicalOrderCount: p.historicalOrderCount ?? undefined,
            successfulOrderCount: p.successfulOrderCount ?? undefined,
            stableOrderCount: p.stableOrderCount ?? undefined,
            catalogConfidenceScore: p.catalogConfidenceScore ?? undefined,
            isCertified: Boolean(p.isCertified),
            certifiedAt: p.certifiedAt ? new Date(p.certifiedAt).toISOString() : undefined,
            lastQuotedAt: p.lastQuotedAt ? new Date(p.lastQuotedAt).toISOString() : undefined,
            lastPurchasedAt: p.lastPurchasedAt ? new Date(p.lastPurchasedAt).toISOString() : undefined,
            lastVerifiedAt: p.lastVerifiedAt ? new Date(p.lastVerifiedAt).toISOString() : undefined,
            lastPriceAlertAt: p.lastPriceAlertAt ? new Date(p.lastPriceAlertAt).toISOString() : undefined,
            qcRecommendedLevel: p.qcRecommendedLevel ?? undefined,
            weightEstimate: p.weightEstimate != null ? Number(p.weightEstimate) : undefined,
            volumeEstimate: p.volumeEstimate != null ? Number(p.volumeEstimate) : undefined,
            specsJson: p.specsJson && Object.keys(p.specsJson).length > 0 ? p.specsJson : undefined,
            notes: p.notes ?? "",
          }}
        />
      </div>
    </div>
  );
}
