"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { confirmQuoteSubmittedPayment, rejectQuoteSubmittedPayment } from "@/lib/actions/quote.actions";

type QuotePaymentActionsProps = {
  quoteId: string;
  disabled?: boolean;
  paymentReference?: string | null;
};

export function QuotePaymentActions({
  quoteId,
  disabled = false,
  paymentReference,
}: QuotePaymentActionsProps) {
  const router = useRouter();
  const [action, setAction] = useState<"confirm" | "reject" | null>(null);
  const [isPending, startTransition] = useTransition();

  function runAction(nextAction: "confirm" | "reject") {
    startTransition(async () => {
      const result =
        nextAction === "confirm"
          ? await confirmQuoteSubmittedPayment(quoteId)
          : await rejectQuoteSubmittedPayment(quoteId);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(
        nextAction === "confirm" ? "Paiement confirme et devis mis a jour" : "Paiement rejete et remis en attente"
      );
      router.refresh();
      setAction(null);
    });
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <AlertDialog open={action === "confirm"} onOpenChange={(open) => setAction(open ? "confirm" : null)}>
        <AlertDialogTrigger asChild>
          <Button size="sm" disabled={disabled || isPending}>
            {isPending && action === "confirm" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Confirmer
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer le paiement soumis ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action validera le paiement declare par le client et fera avancer la commande.
              {paymentReference ? ` Reference recue : ${paymentReference}.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction disabled={isPending} onClick={() => runAction("confirm")}>
              {isPending && action === "confirm" ? "Confirmation..." : "Confirmer le paiement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={action === "reject"} onOpenChange={(open) => setAction(open ? "reject" : null)}>
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="outline" disabled={disabled || isPending}>
            {isPending && action === "reject" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-2 h-4 w-4" />
            )}
            Rejeter
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeter ce paiement soumis ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le paiement sera annule cote ERP et le devis reviendra a l&apos;etat en attente de paiement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={isPending} onClick={() => runAction("reject")}>
              {isPending && action === "reject" ? "Rejet..." : "Rejeter le paiement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
