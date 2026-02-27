"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { createPayment } from "@/lib/actions/payment.actions";
import { convertCurrency, CURRENCIES } from "@/config/currencies";
import { formatDate } from "@/lib/utils";

type Payment = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  type: string;
  status: string;
  amount: any;
  amountXAF: any;
  currency: string;
  method?: string | null;
  reference?: string | null;
  dueAt?: Date | null;
  createdAt: Date;
};

const TYPE_LABELS: Record<string, string> = {
  CLIENT_DEPOSIT: "Acompte client",
  CLIENT_BALANCE: "Solde client",
  SUPPLIER_PAYMENT: "Paiement fournisseur",
  FREIGHT_PAYMENT: "Fret",
  CUSTOMS_DUTY: "Droits de douane",
  QC_PAYMENT: "QC",
  COMMISSION: "Commission",
  REFUND: "Remboursement",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-800",
  PROCESSING: "bg-blue-100 text-blue-800",
  CONFIRMED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-200 text-gray-500",
  REFUNDED: "bg-orange-100 text-orange-800",
};

const formSchema = z.object({
  direction: z.enum(["INBOUND", "OUTBOUND"]),
  type: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default("XAF"),
  fxRate: z.number().positive().optional(),
  method: z.string().optional(),
  reference: z.string().optional(),
  dueAt: z.string().optional(),
  notes: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof formSchema>;

export function OrderPayments({
  orderId,
  totalClient,
  payments,
  canCreate,
  canView,
}: {
  orderId: string;
  totalClient: number;
  payments: Payment[];
  canCreate?: boolean;
  canView?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const summary = useMemo(() => {
    const confirmedInbound = payments
      .filter((p) => p.direction === "INBOUND" && p.status === "CONFIRMED")
      .reduce((sum, p) => sum + Number(p.amountXAF), 0);
    const confirmedOutbound = payments
      .filter((p) => p.direction === "OUTBOUND" && p.status === "CONFIRMED")
      .reduce((sum, p) => sum + Number(p.amountXAF), 0);
    const outstanding = Math.max(0, totalClient - confirmedInbound);
    const hasLate = payments.some((p) =>
      p.direction === "INBOUND" &&
      p.status !== "CONFIRMED" &&
      p.dueAt &&
      new Date(p.dueAt).getTime() < Date.now()
    );
    const status =
      confirmedInbound >= totalClient
        ? "Paye"
        : confirmedInbound > 0
          ? (hasLate ? "Partiel en retard" : "Partiel")
          : (hasLate ? "En retard" : "Non paye");
    return { confirmedInbound, confirmedOutbound, outstanding, status, hasLate };
  }, [payments, totalClient]);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      direction: "INBOUND",
      type: "CLIENT_DEPOSIT",
      amount: 0,
      currency: "XAF",
    },
  });

  async function onSubmit(values: PaymentFormValues) {
    setSubmitting(true);
    try {
      const currency = values.currency || "XAF";
      const amount = Number(values.amount);
      const fxRate = values.fxRate;
      let amountXAF = amount;
      try {
        amountXAF = currency === "XAF"
          ? amount
          : (fxRate ? amount * fxRate : convertCurrency(amount, currency, "XAF"));
      } catch {
        toast.error("Taux FX manquant pour la conversion");
        return;
      }

      const res = await createPayment({
        orderId,
        direction: values.direction,
        type: values.type,
        amount,
        currency,
        amountXAF,
        fxRate: fxRate || undefined,
        method: values.method || undefined,
        reference: values.reference || undefined,
        notes: values.notes || undefined,
        dueAt: values.dueAt || undefined,
      } as any);

      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Paiement ajoute");
      setOpen(false);
      form.reset();
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error("Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  if (!canView) {
    return (
      <div className="rounded-lg border p-6 text-sm text-muted-foreground">
        Acces limite aux paiements.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Encaissements confirmes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              <CurrencyDisplay amount={summary.confirmedInbound} currency="XAF" />
            </p>
            <p className="text-xs text-muted-foreground">Statut: {summary.status}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Decaissements confirmes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              <CurrencyDisplay amount={summary.confirmedOutbound} currency="XAF" />
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Reste a payer</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              <CurrencyDisplay amount={summary.outstanding} currency="XAF" />
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Paiements</h3>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Ajouter un paiement
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Nouveau paiement</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="direction"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Direction</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="INBOUND">Entrant</SelectItem>
                              <SelectItem value="OUTBOUND">Sortant</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Montant</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={field.value ?? ""}
                              onChange={(e) => field.onChange(Number(e.target.value))}
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
                              <SelectTrigger><SelectValue /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.values(CURRENCIES).map((c) => (
                                <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="fxRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Taux FX (optionnel)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.0001"
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
                      name="dueAt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Echeance (optionnel)</FormLabel>
                          <FormControl>
                            <Input type="date" value={field.value ?? ""} onChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="method"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Methode</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Virement, cash..." />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="reference"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reference</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Ref bancaire" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea rows={3} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button type="submit" disabled={submitting}>
                      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Enregistrer
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {payments.length === 0 ? (
        <div className="rounded-lg border p-6 text-sm text-muted-foreground text-center">
          Aucun paiement lie a cette commande.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Echeance</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{TYPE_LABELS[payment.type] || payment.type}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={payment.direction === "INBOUND" ? "text-green-700" : "text-red-700"}>
                      {payment.direction === "INBOUND" ? "Entrant" : "Sortant"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    <CurrencyDisplay amount={Number(payment.amountXAF)} currency="XAF" />
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[payment.status] || ""}>{payment.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {payment.dueAt ? formatDate(payment.dueAt) : "-"}
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(payment.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
