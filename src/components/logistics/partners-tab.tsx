"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Edit, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

import { LogisticsDashboardData } from "@/components/logistics/types";
import { createFreightPartner, deleteFreightPartner, updateFreightPartner } from "@/lib/actions/logistics.actions";

function formatNumber(value: number, digits = 0) {
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function PartnersTab({
  data,
  canManage,
}: {
  data: LogisticsDashboardData;
  canManage: boolean;
}) {
  const [addPartnerOpen, setAddPartnerOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [partnerForm, setPartnerForm] = useState({
    name: "",
    country: "",
    city: "",
    type: "Forwarder",
    contactName: "",
    phone: "",
    whatsapp: "",
    email: "",
    wechat: "",
    website: "",
    address: "",
    operationsPhone: "",
    financeEmail: "",
    supportedModes: "",
    serviceLanes: "",
    originHub: "",
    destinationHub: "",
    kgBuyRateXAF: "",
    cbmBuyRateXAF: "",
    container20RateXAF: "",
    container40RateXAF: "",
    customsBrokerage: true,
    customsDeclarant: false,
    supportsDap: false,
    warehousing: false,
    apiEnabled: false,
    serviceRoles: "",
    dapMissionScope: "",
    paymentTerms: "",
    incoterms: "",
    rating: "80",
    notes: "",
  });
  const [actionPending, startActionTransition] = useTransition();
  const router = useRouter();

  const handleSavePartner = () => {
    startActionTransition(async () => {
      const payload = {
        ...partnerForm,
        rating: Number(partnerForm.rating || 50),
        contactsJson: {
          operationsPhone: partnerForm.operationsPhone || undefined,
          financeEmail: partnerForm.financeEmail || undefined,
        },
        serviceProfileJson: {
          supportedModes: partnerForm.supportedModes
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          serviceLanes: partnerForm.serviceLanes || undefined,
          originHub: partnerForm.originHub || undefined,
          destinationHub: partnerForm.destinationHub || undefined,
          kgBuyRateXAF: partnerForm.kgBuyRateXAF ? Number(partnerForm.kgBuyRateXAF) : undefined,
          cbmBuyRateXAF: partnerForm.cbmBuyRateXAF ? Number(partnerForm.cbmBuyRateXAF) : undefined,
          container20RateXAF: partnerForm.container20RateXAF ? Number(partnerForm.container20RateXAF) : undefined,
          container40RateXAF: partnerForm.container40RateXAF ? Number(partnerForm.container40RateXAF) : undefined,
          customsBrokerage: partnerForm.customsBrokerage,
          customsDeclarant: partnerForm.customsDeclarant,
          supportsDap: partnerForm.supportsDap,
          warehousing: partnerForm.warehousing,
          apiEnabled: partnerForm.apiEnabled,
          serviceRoles: partnerForm.serviceRoles
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          dapMissionScope: partnerForm.dapMissionScope || undefined,
          paymentTerms: partnerForm.paymentTerms || undefined,
          incoterms: partnerForm.incoterms || undefined,
        },
      };
      const res =
        formMode === "edit" && editingId
          ? await updateFreightPartner(editingId, payload)
          : await createFreightPartner(payload);
      if (res.error) toast.error(res.error);
      else {
        toast.success(formMode === "edit" ? "Partenaire mis à jour" : "Partenaire ajouté");
        setAddPartnerOpen(false);
        setPartnerForm({
          name: "",
          country: "",
          city: "",
          type: "Forwarder",
          contactName: "",
          phone: "",
          whatsapp: "",
          email: "",
          wechat: "",
          website: "",
          address: "",
          operationsPhone: "",
          financeEmail: "",
          supportedModes: "",
          serviceLanes: "",
          originHub: "",
          destinationHub: "",
          kgBuyRateXAF: "",
          cbmBuyRateXAF: "",
          container20RateXAF: "",
          container40RateXAF: "",
          customsBrokerage: true,
          customsDeclarant: false,
          supportsDap: false,
          warehousing: false,
          apiEnabled: false,
          serviceRoles: "",
          dapMissionScope: "",
          paymentTerms: "",
          incoterms: "",
          rating: "80",
          notes: "",
        });
        setEditingId(null);
        setFormMode("create");
        router.refresh();
      }
    });
  };

  const handleDeletePartner = (partnerId: string) => {
    startActionTransition(async () => {
      const res = await deleteFreightPartner(partnerId);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Partenaire supprime");
        router.refresh();
      }
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-green-600" />
            Partenaires fret
          </CardTitle>
          {canManage && (
            <Button size="sm" onClick={() => setAddPartnerOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.freightPartners.length === 0 && (
            <div className="col-span-full rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              Aucun partenaire enregistre
            </div>
          )}
          {data.freightPartners.map((partner) => (
            <Card key={partner.id} className="border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{partner.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {partner.type} - {partner.city ? `${partner.city}, ` : ""}{partner.country}
                    </p>
                  </div>
                  <Badge variant={partner.apiConnected ? "default" : "secondary"}>
                    {partner.apiConnected ? "API" : "Manual"}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Fiabilite</span>
                    <span>{partner.reliabilityScore}/100</span>
                  </div>
                  <Progress value={partner.reliabilityScore} className="h-1.5" />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>Modes: {partner.modes.length ? partner.modes.join(", ") : "-"}</div>
                  <div>Actives: {partner.activeShipments}</div>
                  <div>OTD: {formatNumber(partner.onTimeRate, 0)}%</div>
                  <div>Retard: {formatNumber(partner.lateShipmentPercent, 0)}%</div>
                  <div>Cout/kg: {formatNumber(partner.costPerKg, 2)}</div>
                  <div>Cout/cbm: {formatNumber(partner.costPerCbm, 2)}</div>
                </div>
                {Boolean(
                  partner.serviceProfileJson?.kgBuyRateXAF ||
                    partner.serviceProfileJson?.cbmBuyRateXAF ||
                    partner.serviceProfileJson?.container20RateXAF ||
                    partner.serviceProfileJson?.container40RateXAF
                ) && (
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>
                      Tarif kg:{" "}
                      {typeof partner.serviceProfileJson?.kgBuyRateXAF === "number"
                        ? `${formatNumber(partner.serviceProfileJson.kgBuyRateXAF, 0)} XAF`
                        : "-"}
                    </div>
                    <div>
                      Tarif CBM:{" "}
                      {typeof partner.serviceProfileJson?.cbmBuyRateXAF === "number"
                        ? `${formatNumber(partner.serviceProfileJson.cbmBuyRateXAF, 0)} XAF`
                        : "-"}
                    </div>
                    <div>
                      20':{" "}
                      {typeof partner.serviceProfileJson?.container20RateXAF === "number"
                        ? `${formatNumber(partner.serviceProfileJson.container20RateXAF, 0)} XAF`
                        : "-"}
                    </div>
                    <div>
                      40':{" "}
                      {typeof partner.serviceProfileJson?.container40RateXAF === "number"
                        ? `${formatNumber(partner.serviceProfileJson.container40RateXAF, 0)} XAF`
                        : "-"}
                    </div>
                  </div>
                )}
                {Boolean(
                  Array.isArray(partner.serviceProfileJson?.serviceRoles) ||
                    partner.serviceProfileJson?.supportsDap ||
                    partner.serviceProfileJson?.customsDeclarant
                ) && (
                  <div className="text-xs text-muted-foreground">
                    Rôles:{" "}
                    {Array.isArray(partner.serviceProfileJson?.serviceRoles)
                      ? partner.serviceProfileJson.serviceRoles.join(", ")
                      : "-"}
                    {partner.serviceProfileJson?.supportsDap ? " • DAP" : ""}
                    {partner.serviceProfileJson?.customsDeclarant ? " • Déclarant douane" : ""}
                  </div>
                )}
                {(partner.whatsapp || partner.website) && (
                  <div className="text-xs text-muted-foreground">
                    {partner.whatsapp ? `WhatsApp: ${partner.whatsapp}` : ""}
                    {partner.whatsapp && partner.website ? " • " : ""}
                    {partner.website ? partner.website : ""}
                  </div>
                )}
                {canManage && (
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setFormMode("edit");
                        setEditingId(partner.id);
                        setPartnerForm({
                          name: partner.name,
                          country: partner.country,
                          city: partner.city || "",
                          type: partner.type,
                          contactName: partner.contactName || "",
                          phone: partner.phone || "",
                          whatsapp: partner.whatsapp || "",
                          email: partner.email || "",
                          wechat: partner.wechat || "",
                          website: partner.website || "",
                          address: partner.address || "",
                          operationsPhone:
                            typeof partner.contactsJson?.operationsPhone === "string"
                              ? partner.contactsJson.operationsPhone
                              : "",
                          financeEmail:
                            typeof partner.contactsJson?.financeEmail === "string"
                              ? partner.contactsJson.financeEmail
                              : "",
                          supportedModes: Array.isArray(partner.serviceProfileJson?.supportedModes)
                            ? partner.serviceProfileJson.supportedModes.join(", ")
                            : "",
                          serviceLanes:
                            typeof partner.serviceProfileJson?.serviceLanes === "string"
                              ? partner.serviceProfileJson.serviceLanes
                              : "",
                          originHub:
                            typeof partner.serviceProfileJson?.originHub === "string"
                              ? partner.serviceProfileJson.originHub
                              : "",
                          destinationHub:
                            typeof partner.serviceProfileJson?.destinationHub === "string"
                              ? partner.serviceProfileJson.destinationHub
                              : "",
                          kgBuyRateXAF:
                            typeof partner.serviceProfileJson?.kgBuyRateXAF === "number"
                              ? String(partner.serviceProfileJson.kgBuyRateXAF)
                              : "",
                          cbmBuyRateXAF:
                            typeof partner.serviceProfileJson?.cbmBuyRateXAF === "number"
                              ? String(partner.serviceProfileJson.cbmBuyRateXAF)
                              : "",
                          container20RateXAF:
                            typeof partner.serviceProfileJson?.container20RateXAF === "number"
                              ? String(partner.serviceProfileJson.container20RateXAF)
                              : "",
                          container40RateXAF:
                            typeof partner.serviceProfileJson?.container40RateXAF === "number"
                              ? String(partner.serviceProfileJson.container40RateXAF)
                              : "",
                          customsBrokerage: Boolean(partner.serviceProfileJson?.customsBrokerage),
                          customsDeclarant: Boolean(partner.serviceProfileJson?.customsDeclarant),
                          supportsDap: Boolean(partner.serviceProfileJson?.supportsDap),
                          warehousing: Boolean(partner.serviceProfileJson?.warehousing),
                          apiEnabled: Boolean(partner.serviceProfileJson?.apiEnabled),
                          serviceRoles: Array.isArray(partner.serviceProfileJson?.serviceRoles)
                            ? partner.serviceProfileJson.serviceRoles.join(", ")
                            : "",
                          dapMissionScope:
                            typeof partner.serviceProfileJson?.dapMissionScope === "string"
                              ? partner.serviceProfileJson.dapMissionScope
                              : "",
                          paymentTerms:
                            typeof partner.serviceProfileJson?.paymentTerms === "string"
                              ? partner.serviceProfileJson.paymentTerms
                              : "",
                          incoterms:
                            typeof partner.serviceProfileJson?.incoterms === "string"
                              ? partner.serviceProfileJson.incoterms
                              : "",
                          rating: String(partner.rating ?? 50),
                          notes: partner.notes || "",
                        });
                        setAddPartnerOpen(true);
                      }}
                    >
                      <Edit className="h-3 w-3 mr-1" /> Editer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeletePartner(partner.id)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Supprimer
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      <Dialog open={addPartnerOpen} onOpenChange={setAddPartnerOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{formMode === "edit" ? "Editer partenaire" : "Ajouter partenaire"}</DialogTitle>
            <DialogDescription>
              {formMode === "edit" ? "Mettre a jour le partenaire fret" : "Enregistrer un nouveau partenaire fret"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nom</Label>
                <Input
                  value={partnerForm.name}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Pays</Label>
                <Input
                  value={partnerForm.country}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, country: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ville</Label>
                <Input
                  value={partnerForm.city}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, city: e.target.value }))}
                />
              </div>
              <div>
                <Label>Type</Label>
                <Input
                  value={partnerForm.type}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, type: e.target.value }))}
                />
              </div>
              <div>
                <Label>Rating</Label>
                <Input
                  type="number"
                  value={partnerForm.rating}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, rating: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Contact</Label>
                <Input
                  value={partnerForm.contactName}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, contactName: e.target.value }))}
                />
              </div>
              <div>
                <Label>Telephone</Label>
                <Input
                  value={partnerForm.phone}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>WhatsApp</Label>
                <Input
                  value={partnerForm.whatsapp}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, whatsapp: e.target.value }))}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  value={partnerForm.email}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div>
                <Label>WeChat</Label>
                <Input
                  value={partnerForm.wechat}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, wechat: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Site web</Label>
                <Input
                  value={partnerForm.website}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, website: e.target.value }))}
                />
              </div>
              <div>
                <Label>Adresse</Label>
                <Input
                  value={partnerForm.address}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, address: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tel operations</Label>
                <Input
                  value={partnerForm.operationsPhone}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, operationsPhone: e.target.value }))}
                />
              </div>
              <div>
                <Label>Email finance</Label>
                <Input
                  value={partnerForm.financeEmail}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, financeEmail: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Modes supportes</Label>
                <Input
                  value={partnerForm.supportedModes}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, supportedModes: e.target.value }))}
                  placeholder="AIR, SEA, ROAD"
                />
              </div>
              <div>
                <Label>Couloirs / lanes</Label>
                <Input
                  value={partnerForm.serviceLanes}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, serviceLanes: e.target.value }))}
                  placeholder="CN -> CG, CN -> DOUALA"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Hub origine</Label>
                <Input
                  value={partnerForm.originHub}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, originHub: e.target.value }))}
                  placeholder="Guangzhou"
                />
              </div>
              <div>
                <Label>Hub destination</Label>
                <Input
                  value={partnerForm.destinationHub}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, destinationHub: e.target.value }))}
                  placeholder="Pointe-Noire"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prix négocié / kg (XAF)</Label>
                <Input
                  type="number"
                  value={partnerForm.kgBuyRateXAF}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, kgBuyRateXAF: e.target.value }))}
                  placeholder="9500"
                />
              </div>
              <div>
                <Label>Prix négocié / CBM (XAF)</Label>
                <Input
                  type="number"
                  value={partnerForm.cbmBuyRateXAF}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, cbmBuyRateXAF: e.target.value }))}
                  placeholder="265000"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prix conteneur 20' (XAF)</Label>
                <Input
                  type="number"
                  value={partnerForm.container20RateXAF}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, container20RateXAF: e.target.value }))}
                  placeholder="3500000"
                />
              </div>
              <div>
                <Label>Prix conteneur 40' (XAF)</Label>
                <Input
                  type="number"
                  value={partnerForm.container40RateXAF}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, container40RateXAF: e.target.value }))}
                  placeholder="6200000"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Conditions de paiement</Label>
                <Input
                  value={partnerForm.paymentTerms}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, paymentTerms: e.target.value }))}
                  placeholder="30 jours, cash before shipment..."
                />
              </div>
              <div>
                <Label>Incoterms</Label>
                <Input
                  value={partnerForm.incoterms}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, incoterms: e.target.value }))}
                  placeholder="FOB, CIF, DDP..."
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Rôles de service</Label>
                <Input
                  value={partnerForm.serviceRoles}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, serviceRoles: e.target.value }))}
                  placeholder="FORWARDER, CUSTOMS_DECLARANT, DAP_CLEARANCE"
                />
              </div>
              <div>
                <Label>Périmètre mission DAP</Label>
                <Input
                  value={partnerForm.dapMissionScope}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, dapMissionScope: e.target.value }))}
                  placeholder="Dédouanement + livraison finale"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 rounded-lg border p-3 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={partnerForm.customsBrokerage}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, customsBrokerage: e.target.checked }))}
                />
                Douane
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={partnerForm.customsDeclarant}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, customsDeclarant: e.target.checked }))}
                />
                Déclarant douane
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={partnerForm.supportsDap}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, supportsDap: e.target.checked }))}
                />
                Mission DAP
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={partnerForm.warehousing}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, warehousing: e.target.checked }))}
                />
                Entreposage
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={partnerForm.apiEnabled}
                  onChange={(e) => setPartnerForm((p) => ({ ...p, apiEnabled: e.target.checked }))}
                />
                API
              </label>
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                value={partnerForm.notes}
                onChange={(e) => setPartnerForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPartnerOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSavePartner} disabled={actionPending}>
              {formMode === "edit" ? "Mettre a jour" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

