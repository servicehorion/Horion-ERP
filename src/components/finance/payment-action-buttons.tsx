"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { confirmPayment, cancelPayment } from "@/lib/actions/payment.actions";
import { useRouter } from "next/navigation";

interface PaymentActionButtonsProps {
  paymentId: string;
  status: string;
  orderNumber: string;
}

export function PaymentActionButtons({ paymentId, status, orderNumber }: PaymentActionButtonsProps) {
  const router = useRouter();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  if (!["PENDING", "PROCESSING"].includes(status)) return null;

  async function handleConfirm() {
    setConfirmingId(paymentId);
    try {
      const result = await confirmPayment(paymentId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Paiement confirmé — ${orderNumber}`);
        router.refresh();
      }
    } catch {
      toast.error("Erreur lors de la confirmation");
    } finally {
      setConfirmingId(null);
    }
  }

  async function handleCancel() {
    setCancellingId(paymentId);
    try {
      const result = await cancelPayment(paymentId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Paiement annulé — ${orderNumber}`);
        router.refresh();
      }
    } catch {
      toast.error("Erreur lors de l'annulation");
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="flex items-center gap-1">
      {/* Confirm */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
            disabled={confirmingId === paymentId}
            title="Confirmer le paiement"
          >
            {confirmingId === paymentId ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer ce paiement ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le paiement de la commande <strong>{orderNumber}</strong> sera confirmé.
              La marge sera recalculée et une écriture comptable sera générée automatiquement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="bg-green-600 hover:bg-green-700"
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
            disabled={cancellingId === paymentId}
            title="Annuler le paiement"
          >
            {cancellingId === paymentId ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <XCircle className="h-3.5 w-3.5" />
            )}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler ce paiement ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le paiement de la commande <strong>{orderNumber}</strong> sera annulé.
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-red-600 hover:bg-red-700"
            >
              Annuler le paiement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
