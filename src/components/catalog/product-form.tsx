"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createProduct } from "@/lib/actions/catalog.actions";
import { createProductSchema } from "@/lib/validators/catalog";
import type { z } from "zod";

type CreateProductInput = z.infer<typeof createProductSchema>;

interface ProductFormProps {
  categories: { id: string; name: string }[];
}

export function ProductForm({ categories }: ProductFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CreateProductInput>({
    resolver: zodResolver(createProductSchema) as any,
    defaultValues: {
      name: "",
      categoryId: undefined,
      status: "TESTING",
      aliasesJson: [],
      searchKeywordsJson: [],
      specsJson: undefined,
      moqMin: undefined,
      priceMin: undefined,
      priceMax: undefined,
      priceCurrency: "RMB",
      preferredPlatform: "1688",
      defaultRiskBufferPct: 15,
      defaultHiddenMarginPct: 30,
      qcRecommendedLevel: undefined,
      weightEstimate: undefined,
      volumeEstimate: undefined,
      notes: "",
    },
  });

  async function onSubmit(data: CreateProductInput) {
    setIsSubmitting(true);
    try {
      // Parse specsJson from textarea string if present
      const payload: Record<string, unknown> = { ...data };
      if (typeof payload.specsJson === "string") {
        try {
          payload.specsJson = JSON.parse(payload.specsJson as string);
        } catch {
          toast.error("Le JSON des specifications est invalide");
          setIsSubmitting(false);
          return;
        }
      }

      const result = await createProduct(payload);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Produit cree avec succes");
      router.push("/catalog/products");
    } catch (error) {
      toast.error("Une erreur est survenue");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nom du produit *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Ex: iPhone 15 Pro Max" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categorie</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selectionner une categorie" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Statut</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="TESTING">Testing</SelectItem>
                    <SelectItem value="TESTED">Tested</SelectItem>
                    <SelectItem value="CURATED">Curated</SelectItem>
                    <SelectItem value="BLACKLIST">Blacklist</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="moqMin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>MOQ minimum</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    min="0"
                    placeholder="0"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === "" ? undefined : Number(e.target.value)
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="priceMin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prix minimum</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === "" ? undefined : Number(e.target.value)
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="priceMax"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prix maximum</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === "" ? undefined : Number(e.target.value)
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="priceCurrency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Devise</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value || "RMB"}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="RMB">RMB</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="XAF">XAF</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="preferredPlatform"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Plateforme prioritaire</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="1688, Taobao, Alibaba..." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="qcRecommendedLevel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Niveau QC recommande</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selectionner un niveau" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="VIRTUAL">Virtuel</SelectItem>
                    <SelectItem value="PRE_SHIPMENT">Pre-expedition</SelectItem>
                    <SelectItem value="EXTREME">Extreme</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="weightEstimate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Poids estime (kg)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === "" ? undefined : Number(e.target.value)
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="volumeEstimate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Volume estime (m3)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    min="0"
                    step="0.001"
                    placeholder="0.000"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === "" ? undefined : Number(e.target.value)
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <FormField
            control={form.control}
            name="aliasesJson"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Alias produit</FormLabel>
                <FormControl>
                  <Input
                    value={Array.isArray(field.value) ? field.value.join(", ") : ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value
                          .split(",")
                          .map((value) => value.trim())
                          .filter(Boolean)
                      )
                    }
                    placeholder="Ex: coque iphone 15, case iphone 15"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="searchKeywordsJson"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mots-clés mémoire</FormLabel>
                <FormControl>
                  <Input
                    value={Array.isArray(field.value) ? field.value.join(", ") : ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value
                          .split(",")
                          .map((value) => value.trim())
                          .filter(Boolean)
                      )
                    }
                    placeholder="Ex: accessoire mobile, iphone, silicone"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          Les metriques derivees du Catalog OS sont maintenant calculees automatiquement.
          Ici, on regle seulement les parametres metier stables; le reste vient du terrain.
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <FormField
            control={form.control}
            name="defaultRiskBufferPct"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Buffer risque %</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === "" ? undefined : Number(e.target.value)
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="defaultHiddenMarginPct"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Marge cachée %</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === "" ? undefined : Number(e.target.value)
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="specsJson"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Specifications (JSON)</FormLabel>
              <FormControl>
                <Textarea
                  value={
                    typeof field.value === "object" && field.value
                      ? JSON.stringify(field.value, null, 2)
                      : String(field.value ?? "")
                  }
                  onChange={(e) => field.onChange(e.target.value)}
                  placeholder='{"couleur": "noir", "taille": "256GB"}'
                  rows={4}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="Informations supplementaires..."
                  rows={3}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Annuler
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Creer le produit
          </Button>
        </div>
      </form>
    </Form>
  );
}
