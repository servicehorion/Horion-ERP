"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2, Plus, Send, CheckCircle, XCircle, Clock, FileDown } from "lucide-react";
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
import { createQuote, sendQuote, acceptQuote, rejectQuote, expireQuote, exportQuotePDF } from "@/lib/actions/order.actions";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { CURRENCIES } from "@/config/currencies";
import { formatDate } from "@/lib/utils";

type Quote = {
  id: string;
  version: number;
  status: string;
  merchandiseTotal: any;
  logisticsCost: any;
  commission: any;
  insuranceCost: any;
  total: any;
  currency: string;
  validUntil?: Date | null;
  createdAt: Date;
  sentAt?: Date | null;
  acceptedAt?: Date | null;
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  SENT: "bg-blue-100 text-blue-800",
  ACCEPTED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  EXPIRED: "bg-gray-200 text-gray-500",
};

const formSchema = z.object({
  merchandiseTotal: z.number().nonnegative(),
  logisticsCost: z.number().nonnegative(),
  commission: z.number().nonnegative(),
  insuranceCost: z.number().nonnegative().optional(),
  currency: z.string().default("XAF"),
  validUntil: z.string().optional(),
});

type QuoteFormValues = z.infer<typeof formSchema>;

export function OrderQuotes({
  orderId,
  quotes,
  defaults,
  canCreate,
  canSend,
}: {
  orderId: string;
  quotes: Quote[];
  defaults: { merchandiseTotal: number; logisticsCost: number; commission: number; insuranceCost?: number };
  canCreate?: boolean;
  canSend?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      merchandiseTotal: defaults.merchandiseTotal,
      logisticsCost: defaults.logisticsCost,
      commission: defaults.commission,
      insuranceCost: defaults.insuranceCost || 0,
      currency: "XAF",
    },
  });

  const watched = form.watch();
  const previewTotal = useMemo(() => {
    return (watched.merchandiseTotal || 0) + (watched.logisticsCost || 0) + (watched.commission || 0) + (watched.insuranceCost || 0);
  }, [watched]);

  async function onSubmit(values: QuoteFormValues) {
    setSubmitting(true);
    try {
      const res = await createQuote({
        orderId,
        merchandiseTotal: values.merchandiseTotal,
        logisticsCost: values.logisticsCost,
        commission: values.commission,
        insuranceCost: values.insuranceCost || 0,
        currency: values.currency,
        validUntil: values.validUntil || undefined,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Devis cree");
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

  async function handleAction(action: "send" | "accept" | "reject" | "expire", quoteId: string) {
    setWorkingId(quoteId);
    try {
      const res =
        action === "send" ? await sendQuote(quoteId) :
        action === "accept" ? await acceptQuote(quoteId) :
        action === "reject" ? await rejectQuote(quoteId) :
        await expireQuote(quoteId);

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Action terminee");
        router.refresh();
      }
    } catch {
      toast.error("Erreur");
    } finally {
      setWorkingId(null);
    }
  }

  async function handlePdf(quoteId: string) {
    setWorkingId(quoteId);
    try {
      const res = await exportQuotePDF(quoteId);
      if (res.error || !res.data) {
        toast.error(res.error || "Erreur PDF");
        return;
      }
      const bytes = Uint8Array.from(atob(res.data), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename || `devis-${quoteId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Erreur PDF");
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Devis</h3>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Nouveau devis
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Creer un devis</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="merchandiseTotal"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Marchandise</FormLabel>
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
                      name="logisticsCost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Logistique</FormLabel>
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
                      name="commission"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Commission</FormLabel>
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
                      name="insuranceCost"
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
                      name="validUntil"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Validite</FormLabel>
                          <FormControl>
                            <Input type="date" value={field.value ?? ""} onChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Card className="bg-muted/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Total</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        <CurrencyDisplay amount={previewTotal} currency={watched.currency || "XAF"} />
                      </p>
                    </CardContent>
                  </Card>

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

      {quotes.length === 0 ? (
        <div className="rounded-lg border p-6 text-sm text-muted-foreground text-center">
          Aucun devis pour le moment.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Validite</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((quote) => {
                const isWorking = workingId === quote.id;
                const canSendNow = canSend && quote.status === "DRAFT";
                const canDecide = canSend && quote.status === "SENT";
                const canExpire = canSend && quote.status === "SENT";
                return (
                  <TableRow key={quote.id}>
                    <TableCell className="font-medium">v{quote.version}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[quote.status] || ""}>{quote.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <CurrencyDisplay amount={Number(quote.total)} currency={quote.currency} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {quote.validUntil ? formatDate(quote.validUntil) : "-"}
                    </TableCell>
                    <TableCell className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePdf(quote.id)}
                        disabled={isWorking}
                      >
                        {isWorking ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <FileDown className="mr-1 h-3 w-3" />}
                        PDF
                      </Button>
                      {canSendNow && (
                        <Button size="sm" onClick={() => handleAction("send", quote.id)} disabled={isWorking}>
                          <Send className="mr-1 h-3 w-3" />
                          Envoyer
                        </Button>
                      )}
                      {canDecide && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => handleAction("accept", quote.id)} disabled={isWorking}>
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Accepter
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleAction("reject", quote.id)} disabled={isWorking}>
                            <XCircle className="mr-1 h-3 w-3" />
                            Refuser
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleAction("expire", quote.id)} disabled={isWorking}>
                            <Clock className="mr-1 h-3 w-3" />
                            Expirer
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
