"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSourcingCase } from "@/lib/actions/sourcing.actions";
import { Loader2, Package, Zap } from "lucide-react";

interface Order {
  id: string;
  orderNumber: string;
  contact: { name: string };
  merchandiseTotal: unknown;
  currency: string;
}

const PLATFORMS_INDICATIF = [
  { value: "alibaba", label: "Alibaba" },
  { value: "amazon", label: "Amazon" },
  { value: "aliexpress", label: "AliExpress" },
  { value: "web", label: "Autre site web" },
];

const PLATFORMS_PROFOND = [
  { value: "1688", label: "1688.com" },
  { value: "taobao", label: "Taobao" },
  { value: "pinduoduo", label: "Pinduoduo" },
  { value: "jd", label: "JD.com" },
  { value: "direct", label: "Contact direct fournisseur" },
];

export function SourcingCaseForm({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [level, setLevel] = useState<"INFORMATIF" | "PROFOND">("INFORMATIF");
  const [sensitiveProduct, setSensitiveProduct] = useState(false);
  const [platform, setPlatform] = useState("");

  const platforms = level === "INFORMATIF" ? PLATFORMS_INDICATIF : PLATFORMS_PROFOND;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    const budget = fd.get("budget") as string;

    const result = await createSourcingCase({
      orderId: fd.get("orderId") as string,
      requirement: fd.get("requirement") as string,
      budget: budget ? parseFloat(budget) : undefined,
      currency: (fd.get("currency") as string) || "RMB",
      level,
      platform: platform || undefined,
      sensitiveProduct,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    router.push(`/sourcing/cases/${result.data!.id}`);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Nouveau cas de sourcing
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}

          {/* Level selector */}
          <div className="space-y-2">
            <Label>Niveau de sourcing *</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { setLevel("INFORMATIF"); setPlatform(""); }}
                className={`rounded-lg border-2 p-3 text-left transition-colors ${
                  level === "INFORMATIF"
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/50"
                }`}
              >
                <p className="font-medium text-sm">Indicatif</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  CRM — estimation rapide, prix plateforme + buffer
                </p>
              </button>
              <button
                type="button"
                onClick={() => { setLevel("PROFOND"); setPlatform(""); }}
                className={`rounded-lg border-2 p-3 text-left transition-colors ${
                  level === "PROFOND"
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-muted-foreground/50"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  <p className="font-medium text-sm">Profond</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Logistique — prix réels, poids confirmé, moteur de marge
                </p>
              </button>
            </div>
          </div>

          {/* Order */}
          <div className="space-y-2">
            <Label htmlFor="orderId">Commande associée *</Label>
            <Select name="orderId" required>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une commande" />
              </SelectTrigger>
              <SelectContent>
                {orders.map((order) => (
                  <SelectItem key={order.id} value={order.id}>
                    {order.orderNumber} — {order.contact.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Requirement */}
          <div className="space-y-2">
            <Label htmlFor="requirement">Description du besoin *</Label>
            <Textarea
              id="requirement"
              name="requirement"
              placeholder="Ex: 500 unités de coque iPhone 15, coloris noir mat, logo gravé..."
              rows={3}
              required
            />
          </div>

          {/* Platform + sensitive */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Plateforme source</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {platforms.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <div className="flex items-center gap-2 pt-2">
                <Checkbox
                  id="sensitiveProduct"
                  checked={sensitiveProduct}
                  onCheckedChange={(v) => setSensitiveProduct(!!v)}
                />
                <Label htmlFor="sensitiveProduct" className="cursor-pointer text-sm font-normal">
                  Produit sensible
                  <span className="block text-xs text-muted-foreground">
                    Batteries, liquides, etc.
                  </span>
                </Label>
              </div>
            </div>
          </div>

          {/* Budget */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="budget">Budget estimé</Label>
              <Input
                id="budget"
                name="budget"
                type="number"
                step="0.01"
                min="0"
                placeholder="Ex: 5000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Devise</Label>
              <Select name="currency" defaultValue="RMB">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RMB">RMB (Yuan)</SelectItem>
                  <SelectItem value="USD">USD (Dollar)</SelectItem>
                  <SelectItem value="XAF">XAF (Franc CFA)</SelectItem>
                  <SelectItem value="EUR">EUR (Euro)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {level === "INFORMATIF" && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              En mode Indicatif, le cas est créé avec les informations de base. Les données
              logistiques (poids, dimensions, marge) peuvent être ajoutées après promotion
              en Sourcing Profond depuis la fiche du cas.
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Créer le cas de sourcing
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
