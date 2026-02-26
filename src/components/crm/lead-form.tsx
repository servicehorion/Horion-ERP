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
import { Checkbox } from "@/components/ui/checkbox";
import { createLead, updateLead } from "@/lib/actions/contact.actions";
import { createLeadSchema, type CreateLeadInput } from "@/lib/validators/contact";
import { CURRENCIES } from "@/config/currencies";

interface LeadFormProps {
  lead?: {
    id: string;
    contactId: string;
    source: string | null;
    description: string | null;
    estimatedValue: number | null;
    currency: string;
    category: string | null;
    assignedTo: string | null;
    ownerId?: string | null;
    collaboratorIds?: string[] | null;
    containerType?: "LCL" | "FCL" | "AERIEN" | null;
    originCountry?: string | null;
    notes?: string | null;
  };
  contacts: { id: string; name: string }[];
  teamMembers: { id: string; name: string | null; email: string; role: string }[];
  demoMode?: boolean;
  currentUserId?: string;
}

export function LeadForm({ lead, contacts, teamMembers, demoMode, currentUserId }: LeadFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!lead;

  const form = useForm<CreateLeadInput>({
    resolver: zodResolver(createLeadSchema) as any,
    defaultValues: {
      contactId: lead?.contactId || (contacts[0]?.id ?? ""),
      source: lead?.source || "",
      description: lead?.description || "",
      estimatedValue: lead?.estimatedValue ?? undefined,
      currency: lead?.currency || "XAF",
      category: lead?.category || "",
      assignedTo: lead?.assignedTo || undefined,
      ownerId: lead?.ownerId ?? currentUserId,
      collaboratorIds: lead?.collaboratorIds || [],
      containerType: lead?.containerType ?? undefined,
      originCountry: lead?.originCountry || "CN",
      notes: lead?.notes || "",
    },
  });

  async function onSubmit(data: CreateLeadInput) {
    if (demoMode) {
      toast("Mode demo : action non enregistree.");
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        ...data,
        source: data.source || undefined,
        description: data.description || undefined,
        category: data.category || undefined,
        assignedTo: data.assignedTo || undefined,
        ownerId: data.ownerId || undefined,
        collaboratorIds: data.collaboratorIds || [],
      };

      const result = isEditing
        ? await updateLead(lead!.id, payload as any)
        : await createLead(payload as any);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(isEditing ? "Lead mis Ã  jour" : "Lead crÃ©Ã©");
      router.push(isEditing ? `/crm/leads/${lead!.id}` : "/crm/leads");
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
          <FormField
            control={form.control}
            name="contactId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir un contact" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
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
            name="assignedTo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>AssignÃ© Ã </FormLabel>
                <Select
                  onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                  defaultValue={field.value ?? "none"}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Non assignÃ©" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Non assignÃ©</SelectItem>
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
                    <SelectTrigger>
                      <SelectValue placeholder="Non assignÃƒÂ©" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Non assignÃƒÂ©</SelectItem>
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

          <FormField
            control={form.control}
            name="source"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Source</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="WhatsApp, salon, rÃ©fÃ©rence..." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CatÃ©gorie</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Ex: Ã‰lectronique" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="estimatedValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valeur estimÃ©e</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={field.value ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      field.onChange(v === "" ? undefined : Number(v));
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="currency"
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
                    {Object.values(CURRENCIES).map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} — {c.name}
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
            name="containerType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type de fret</FormLabel>
                <Select
                  onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                  defaultValue={field.value ?? "none"}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Non défini</SelectItem>
                    <SelectItem value="LCL">LCL — Groupage maritime</SelectItem>
                    <SelectItem value="FCL">FCL — Conteneur complet</SelectItem>
                    <SelectItem value="AERIEN">Aérien</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="originCountry"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pays d'origine</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="CN, TH, TR..." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} rows={4} placeholder="DÃ©crivez le besoin du client..." />
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
              <FormLabel>Notes internes</FormLabel>
              <FormControl>
                <Textarea {...field} rows={3} placeholder="Informations complémentaires sur ce lead..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Mettre Ã  jour" : "CrÃ©er le lead"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

