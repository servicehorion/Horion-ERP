"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateProduct } from "@/lib/actions/catalog.actions";
import { updateProductSchema } from "@/lib/validators/catalog";
import type { z } from "zod";

type UpdateProductInput = z.infer<typeof updateProductSchema>;

interface Props {
  productId: string;
  defaultValues: UpdateProductInput;
  categories: { id: string; name: string }[];
}

export function ProductEditForm({ productId, defaultValues, categories }: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<UpdateProductInput>({
    resolver: zodResolver(updateProductSchema) as any,
    defaultValues,
  });

  async function onSubmit(data: UpdateProductInput) {
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = { ...data };
      if (typeof payload.specsJson === "string") {
        try {
          payload.specsJson = payload.specsJson ? JSON.parse(payload.specsJson as string) : undefined;
        } catch {
          toast.error("Le JSON des spécifications est invalide");
          setIsSubmitting(false);
          return;
        }
      }

      const result = await updateProduct(productId, payload);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Produit mis à jour");
      router.push(`/catalog/products/${productId}`);
      router.refresh();
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
                <FormLabel>Catégorie</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une catégorie" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Statut" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="TESTING">En test</SelectItem>
                    <SelectItem value="TESTED">Testé</SelectItem>
                    <SelectItem value="CURATED">Curé</SelectItem>
                    <SelectItem value="BLACKLIST">Blacklisté</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="qcRecommendedLevel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Niveau QC recommandé</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value ?? undefined}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Niveau QC" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="VIRTUAL">Virtual</SelectItem>
                    <SelectItem value="PRE_SHIPMENT">Pre-shipment</SelectItem>
                    <SelectItem value="EXTREME">Extreme</SelectItem>
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
                    type="number"
                    min={0}
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
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
                <Select onValueChange={field.onChange} defaultValue={field.value ?? "RMB"}>
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
            name="priceMin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prix min</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
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
                <FormLabel>Prix max</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="weightEstimate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Poids estimé (kg)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
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
                <FormLabel>Volume estimé (m³)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.0001"
                    min={0}
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
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
              <FormLabel>Spécifications techniques (JSON)</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  value={
                    field.value
                      ? typeof field.value === "string"
                        ? field.value
                        : JSON.stringify(field.value, null, 2)
                      : ""
                  }
                  placeholder='{"couleur": "noir", "taille": "256GB"}'
                  rows={4}
                  className="font-mono text-sm"
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
                  value={field.value ?? ""}
                  placeholder="Notes internes sur ce produit…"
                  rows={3}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sauvegarder les modifications
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/catalog/products/${productId}`)}
          >
            Annuler
          </Button>
        </div>
      </form>
    </Form>
  );
}
