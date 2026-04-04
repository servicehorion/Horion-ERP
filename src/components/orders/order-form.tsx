"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
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
import { createOrder, updateOrder } from "@/lib/actions/order.actions";
import { createOrderSchema, type CreateOrderInput } from "@/lib/validators/order";
import { CURRENCIES } from "@/config/currencies";

interface OrderFormProps {
  contacts: { id: string; name: string }[];
  initialContactId?: string;
  mode?: "create" | "edit";
  orderId?: string;
  initialValues?: Partial<CreateOrderInput>;
}

export function OrderForm({
  contacts,
  initialContactId,
  mode = "create",
  orderId,
  initialValues,
}: OrderFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CreateOrderInput>({
    resolver: zodResolver(createOrderSchema) as any,
    defaultValues: {
      contactId: initialValues?.contactId || initialContactId || "",
      items: initialValues?.items && initialValues.items.length > 0
        ? (initialValues.items as any)
        : [
            {
              description: "",
              quantity: 1,
              unitPrice: 0,
              currency: "XAF",
            },
          ],
      priority: (initialValues?.priority as any) || "NORMAL",
      originCountry: initialValues?.originCountry || "CN",
      destinationCity: initialValues?.destinationCity || "Brazzaville",
      logisticsCost: initialValues?.logisticsCost ?? 0,
      insuranceAmount: initialValues?.insuranceAmount ?? 0,
      commissionRate: initialValues?.commissionRate ?? 0.1,
      notes: initialValues?.notes || "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  async function onSubmit(data: CreateOrderInput) {
    setIsSubmitting(true);
    try {
      const result = mode === "edit" && orderId
        ? await updateOrder(orderId, data as any)
        : await createOrder(data);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(mode === "edit" ? "Commande mise à jour" : "Commande créée avec succès");
      const targetId = mode === "edit" ? orderId : result.data?.id;
      if (targetId) {
        router.push(`/orders/${targetId}`);
      } else {
        router.push("/orders");
      }
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
            name="contactId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un client" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.name}
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
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priorité</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="LOW">Basse</SelectItem>
                    <SelectItem value="NORMAL">Normale</SelectItem>
                    <SelectItem value="HIGH">Haute</SelectItem>
                    <SelectItem value="URGENT">Urgente</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="destinationCity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ville de destination</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Brazzaville" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="originCountry"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pays d&apos;origine</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="CN" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <FormField
            control={form.control}
            name="logisticsCost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Co�t logistique</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={field.value ?? 0}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="insuranceAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Assurance</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={field.value ?? 0}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="commissionRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Taux de commission</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={field.value ?? 0.1}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Articles</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append({
                  description: "",
                  quantity: 1,
                  unitPrice: 0,
                  currency: "XAF",
                })
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un article
            </Button>
          </div>

          {fields.map((field, index) => (
            <div
              key={field.id}
              className="grid gap-4 rounded-lg border p-4 md:grid-cols-12"
            >
              <div className="md:col-span-5">
                <FormField
                  control={form.control}
                  name={`items.${index}.description`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: iPhone 15 Pro Max 256GB" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="md:col-span-2">
                <FormField
                  control={form.control}
                  name={`items.${index}.quantity`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantité</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min="1"
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="md:col-span-2">
                <FormField
                  control={form.control}
                  name={`items.${index}.unitPrice`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prix unitaire</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min="0"
                          step="0.01"
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="md:col-span-2">
                <FormField
                  control={form.control}
                  name={`items.${index}.currency`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Devise</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(CURRENCIES).map((curr) => (
                            <SelectItem key={curr.code} value={curr.code}>
                              {curr.code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {fields.length > 1 && (
                <div className="flex items-end md:col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="Informations supplémentaires..."
                  rows={4}
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
            {mode === "edit" ? "Mettre à jour" : "Créer la commande"}
          </Button>
        </div>
      </form>
    </Form>
  );
}


