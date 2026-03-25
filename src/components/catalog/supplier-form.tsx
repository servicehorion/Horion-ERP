"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import { createCatalogSupplier } from "@/lib/actions/catalog.actions";
import { createSupplierSchema } from "@/lib/validators/catalog";

type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export function SupplierForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [languagesInput, setLanguagesInput] = useState("");
  const [certificationsInput, setCertificationsInput] = useState("");
  const [contactMeta, setContactMeta] = useState({
    altPhone: "",
    contactRole: "",
    timezone: "Asia/Shanghai",
    workingHours: "",
  });
  const [termsMeta, setTermsMeta] = useState({
    incoterm: "EXW",
    sampleAvailable: "yes",
    packagingCapability: "",
    qcPolicy: "",
    refundPolicy: "",
    exportPort: "",
    paymentSplit: "",
  });

  const form = useForm<CreateSupplierInput>({
    resolver: zodResolver(createSupplierSchema) as any,
    defaultValues: {
      name: "",
      platform: "",
      country: "CN",
      city: "",
      contactName: "",
      phone: "",
      whatsapp: "",
      wechat: "",
      email: "",
      website: "",
      storeUrl: "",
      address: "",
      category: "",
      leadTimeDays: undefined,
      sampleLeadTimeDays: undefined,
      responseTimeHours: undefined,
      productionCapacityMonthly: undefined,
      moq: "",
      paymentTerms: "",
      languagesJson: [],
      certificationsJson: [],
      notes: "",
    },
  });

  async function onSubmit(data: CreateSupplierInput) {
    setIsSubmitting(true);
    try {
      const payload = {
        ...data,
        languagesJson: languagesInput
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        certificationsJson: certificationsInput
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        contactsJson: {
          altPhone: contactMeta.altPhone || undefined,
          contactRole: contactMeta.contactRole || undefined,
          timezone: contactMeta.timezone || undefined,
          workingHours: contactMeta.workingHours || undefined,
        },
        negotiatedTermsJson: {
          incoterm: termsMeta.incoterm || undefined,
          sampleAvailable: termsMeta.sampleAvailable === "yes",
          packagingCapability: termsMeta.packagingCapability || undefined,
          qcPolicy: termsMeta.qcPolicy || undefined,
          refundPolicy: termsMeta.refundPolicy || undefined,
          exportPort: termsMeta.exportPort || undefined,
          paymentSplit: termsMeta.paymentSplit || undefined,
        },
      };

      const result = await createCatalogSupplier(payload as any);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Fournisseur créé");
      router.push("/catalog/suppliers");
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
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nom *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Nom du fournisseur" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="platform"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Plateforme</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir une plateforme" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="1688">1688</SelectItem>
                    <SelectItem value="Alibaba">Alibaba</SelectItem>
                    <SelectItem value="Offline">Offline</SelectItem>
                    <SelectItem value="Autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="country"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pays</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="CN" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ville</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Yiwu, Guangzhou..." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contactName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nom du contact</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Nom du contact principal" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Téléphone</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="+86 XXX XXXX XXXX" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="whatsapp"
            render={({ field }) => (
              <FormItem>
                <FormLabel>WhatsApp</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="+86 / +242 ..." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="wechat"
            render={({ field }) => (
              <FormItem>
                <FormLabel>WeChat</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="ID WeChat" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    placeholder="email@example.com"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Site web</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="https://..." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="storeUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>URL boutique</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Lien 1688 / Alibaba / Taobao" />
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
                <FormLabel>Catégorie</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Électronique, Textile..."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Adresse</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Adresse usine / entrepot" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="leadTimeDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Délai de production (jours)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="15"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value ? Number(e.target.value) : undefined
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
            name="sampleLeadTimeDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Délai échantillon (jours)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="7"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value ? Number(e.target.value) : undefined
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
            name="moq"
            render={({ field }) => (
              <FormItem>
                <FormLabel>MOQ</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="100 pièces" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="responseTimeHours"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Temps de réponse (h)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="12"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value ? Number(e.target.value) : undefined
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
            name="paymentTerms"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Conditions de paiement</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="30% acompte, 70% avant expédition" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="productionCapacityMonthly"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Capacité mensuelle</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="5000"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value ? Number(e.target.value) : undefined
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
          <FormItem>
            <FormLabel>Langues</FormLabel>
            <FormControl>
              <Input
                value={languagesInput}
                onChange={(e) => setLanguagesInput(e.target.value)}
                placeholder="Mandarin, Anglais, Français"
              />
            </FormControl>
          </FormItem>

          <FormItem>
            <FormLabel>Certifications</FormLabel>
            <FormControl>
              <Input
                value={certificationsInput}
                onChange={(e) => setCertificationsInput(e.target.value)}
                placeholder="CE, RoHS, ISO9001"
              />
            </FormControl>
          </FormItem>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4 rounded-lg border p-4">
            <p className="text-sm font-medium">Coordination contact</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <FormLabel>Rôle du contact</FormLabel>
                <Input
                  value={contactMeta.contactRole}
                  onChange={(e) => setContactMeta((prev) => ({ ...prev, contactRole: e.target.value }))}
                  placeholder="Sales manager, owner..."
                />
              </div>
              <div className="space-y-2">
                <FormLabel>Téléphone secondaire</FormLabel>
                <Input
                  value={contactMeta.altPhone}
                  onChange={(e) => setContactMeta((prev) => ({ ...prev, altPhone: e.target.value }))}
                  placeholder="+86 ..."
                />
              </div>
              <div className="space-y-2">
                <FormLabel>Fuseau horaire</FormLabel>
                <Input
                  value={contactMeta.timezone}
                  onChange={(e) => setContactMeta((prev) => ({ ...prev, timezone: e.target.value }))}
                  placeholder="Asia/Shanghai"
                />
              </div>
              <div className="space-y-2">
                <FormLabel>Horaires de travail</FormLabel>
                <Input
                  value={contactMeta.workingHours}
                  onChange={(e) => setContactMeta((prev) => ({ ...prev, workingHours: e.target.value }))}
                  placeholder="09:00-18:00 GMT+8"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-lg border p-4">
            <p className="text-sm font-medium">Conditions négociées</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <FormLabel>Incoterm</FormLabel>
                <Input
                  value={termsMeta.incoterm}
                  onChange={(e) => setTermsMeta((prev) => ({ ...prev, incoterm: e.target.value }))}
                  placeholder="EXW, FOB..."
                />
              </div>
              <div className="space-y-2">
                <FormLabel>Disponibilité échantillon</FormLabel>
                <Select
                  value={termsMeta.sampleAvailable}
                  onValueChange={(value) => setTermsMeta((prev) => ({ ...prev, sampleAvailable: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Oui</SelectItem>
                    <SelectItem value="no">Non</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <FormLabel>Capacité packaging</FormLabel>
                <Input
                  value={termsMeta.packagingCapability}
                  onChange={(e) => setTermsMeta((prev) => ({ ...prev, packagingCapability: e.target.value }))}
                  placeholder="Private label, caisse bois..."
                />
              </div>
              <div className="space-y-2">
                <FormLabel>Port export</FormLabel>
                <Input
                  value={termsMeta.exportPort}
                  onChange={(e) => setTermsMeta((prev) => ({ ...prev, exportPort: e.target.value }))}
                  placeholder="Shenzhen, Ningbo..."
                />
              </div>
              <div className="space-y-2">
                <FormLabel>Politique QC</FormLabel>
                <Input
                  value={termsMeta.qcPolicy}
                  onChange={(e) => setTermsMeta((prev) => ({ ...prev, qcPolicy: e.target.value }))}
                  placeholder="AQL, inspection avant départ..."
                />
              </div>
              <div className="space-y-2">
                <FormLabel>Split de paiement</FormLabel>
                <Input
                  value={termsMeta.paymentSplit}
                  onChange={(e) => setTermsMeta((prev) => ({ ...prev, paymentSplit: e.target.value }))}
                  placeholder="30/70, 50/50..."
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <FormLabel>Politique retour / remboursement</FormLabel>
                <Input
                  value={termsMeta.refundPolicy}
                  onChange={(e) => setTermsMeta((prev) => ({ ...prev, refundPolicy: e.target.value }))}
                  placeholder="Conditions SAV, remboursement, remplacement"
                />
              </div>
            </div>
          </div>
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
                  placeholder="Notes internes sur le fournisseur..."
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
            {isSubmitting && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Créer le fournisseur
          </Button>
        </div>
      </form>
    </Form>
  );
}
