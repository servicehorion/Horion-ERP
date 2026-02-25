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
import { Checkbox } from "@/components/ui/checkbox";
import { createContact, updateContact } from "@/lib/actions/contact.actions";
import { createContactSchema, type CreateContactInput } from "@/lib/validators/contact";

interface ContactFormProps {
  contact?: {
    id: string;
    name: string;
    type: string;
    company: string | null;
    phone: string | null;
    email: string | null;
    whatsapp: string | null;
    city: string | null;
    country: string;
    notes: string | null;
    tags?: string[] | null;
    ownerId?: string | null;
    collaboratorIds?: string[] | null;
  };
  teamMembers?: { id: string; name: string | null; email: string; role: string }[];
  currentUserId?: string;
}

export function ContactForm({ contact, teamMembers = [], currentUserId }: ContactFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!contact;
  const [tagsInput, setTagsInput] = useState((contact?.tags || []).join(", "));

  const form = useForm<CreateContactInput>({
    resolver: zodResolver(createContactSchema) as any,
    defaultValues: {
      name: contact?.name || "",
      type: (contact?.type as any) || "CLIENT",
      company: contact?.company || "",
      phone: contact?.phone || "",
      email: contact?.email || "",
      whatsapp: contact?.whatsapp || "",
      city: contact?.city || "",
      country: contact?.country || "CG",
      notes: contact?.notes || "",
      tags: contact?.tags || [],
      ownerId: contact?.ownerId ?? currentUserId,
      collaboratorIds: contact?.collaboratorIds || [],
    },
  });

  async function onSubmit(data: CreateContactInput) {
    setIsSubmitting(true);
    try {
      const result = isEditing
        ? await updateContact(contact.id, data as any)
        : await createContact(data as any);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(isEditing ? "Contact mis à jour" : "Contact créé");
      router.push(isEditing ? `/contacts/${contact.id}` : "/contacts");
    } catch (error) {
      toast.error("Erreur");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <FormField control={form.control} name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nom *</FormLabel>
                <FormControl><Input {...field} placeholder="Nom du contact" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField control={form.control} name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="CLIENT">Client</SelectItem>
                    <SelectItem value="PROSPECT">Prospect</SelectItem>
                    <SelectItem value="SUPPLIER">Fournisseur</SelectItem>
                    <SelectItem value="FREIGHT_PARTNER">Transitaire</SelectItem>
                    <SelectItem value="CUSTOMS_BROKER">Courtier douanier</SelectItem>
                    <SelectItem value="QC_PARTNER">Partenaire QC</SelectItem>
                    <SelectItem value="OTHER">Autre</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="ownerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Owner principal</FormLabel>
                <Select
                  onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                  defaultValue={field.value ?? "none"}
                >
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Non assigné" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Non assigné</SelectItem>
                    {teamMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name || m.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField control={form.control} name="company"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Entreprise</FormLabel>
                <FormControl><Input {...field} placeholder="Nom de l'entreprise" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField control={form.control} name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Téléphone</FormLabel>
                <FormControl><Input {...field} placeholder="+242 06 XXX XXXX" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField control={form.control} name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl><Input {...field} type="email" placeholder="email@example.com" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField control={form.control} name="whatsapp"
            render={({ field }) => (
              <FormItem>
                <FormLabel>WhatsApp</FormLabel>
                <FormControl><Input {...field} placeholder="+242 06 XXX XXXX" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField control={form.control} name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ville</FormLabel>
                <FormControl><Input {...field} placeholder="Brazzaville" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField control={form.control} name="country"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pays</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="CG">Congo-Brazzaville</SelectItem>
                    <SelectItem value="CD">RD Congo</SelectItem>
                    <SelectItem value="CN">Chine</SelectItem>
                    <SelectItem value="FR">France</SelectItem>
                    <SelectItem value="CM">Cameroun</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="collaboratorIds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Collaborateurs</FormLabel>
              <div className="grid gap-2 sm:grid-cols-2">
                {teamMembers.length === 0 && (
                  <p className="text-sm text-muted-foreground">Aucun collaborateur disponible</p>
                )}
                {teamMembers.map((m) => {
                  const checked = (field.value || []).includes(m.id);
                  return (
                    <label key={m.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => {
                          const next = new Set(field.value || []);
                          if (value) {
                            next.add(m.id);
                          } else {
                            next.delete(m.id);
                          }
                          field.onChange(Array.from(next));
                        }}
                      />
                      <span>{m.name || m.email}</span>
                    </label>
                  );
                })}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField control={form.control} name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder="Notes internes..." rows={3} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField control={form.control} name="tags"
          render={() => (
            <FormItem>
              <FormLabel>Tags</FormLabel>
              <FormControl>
                <Input
                  value={tagsInput}
                  placeholder="ex: premium, ecommerce, VIP"
                  onChange={(e) => {
                    const value = e.target.value;
                    setTagsInput(value);
                    const tags = value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean);
                    form.setValue("tags", tags);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Mettre à jour" : "Créer le contact"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
