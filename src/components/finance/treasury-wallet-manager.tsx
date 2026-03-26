"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createTreasuryAccount, createTreasuryTransaction } from "@/lib/actions/finance.actions";

type TreasuryAccountOption = {
  id: string;
  label: string;
  currency: string;
};

export function TreasuryWalletManager({ accounts }: { accounts: TreasuryAccountOption[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [accountForm, setAccountForm] = useState({
    label: "",
    currency: "CNY",
    balance: "",
    alertBelowAmount: "",
  });
  const [txForm, setTxForm] = useState({
    accountId: accounts[0]?.id ?? "",
    type: "TOP_UP",
    amount: "",
    fxRate: "",
    orderId: "",
    reference: "",
  });

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === txForm.accountId) ?? null,
    [accounts, txForm.accountId]
  );

  function runAction(action: () => Promise<{ error?: string }>, successMessage: string) {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(successMessage);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Créer un wallet de trésorerie</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="wallet-label">Libellé</Label>
            <Input
              id="wallet-label"
              value={accountForm.label}
              onChange={(event) => setAccountForm((prev) => ({ ...prev, label: event.target.value }))}
              placeholder="Alipay Chine"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Devise</Label>
              <Select
                value={accountForm.currency}
                onValueChange={(value) => setAccountForm((prev) => ({ ...prev, currency: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CNY">CNY</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="XAF">XAF</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wallet-balance">Solde initial</Label>
              <Input
                id="wallet-balance"
                type="number"
                min="0"
                step="0.01"
                value={accountForm.balance}
                onChange={(event) => setAccountForm((prev) => ({ ...prev, balance: event.target.value }))}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wallet-alert">Seuil d'alerte</Label>
            <Input
              id="wallet-alert"
              type="number"
              min="0"
              step="0.01"
              value={accountForm.alertBelowAmount}
              onChange={(event) =>
                setAccountForm((prev) => ({ ...prev, alertBelowAmount: event.target.value }))
              }
              placeholder="2000"
            />
          </div>

          <Button
            disabled={isPending}
            onClick={() =>
              runAction(
                () =>
                  createTreasuryAccount({
                    label: accountForm.label,
                    currency: accountForm.currency,
                    balance: accountForm.balance,
                    alertBelowAmount: accountForm.alertBelowAmount || undefined,
                  }),
                "Wallet créé"
              )
            }
          >
            Créer le wallet
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enregistrer un mouvement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Compte</Label>
            <Select
              value={txForm.accountId}
              onValueChange={(value) => setTxForm((prev) => ({ ...prev, accountId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un compte" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.label} ({account.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={txForm.type}
                onValueChange={(value) => setTxForm((prev) => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TOP_UP">Rechargement</SelectItem>
                  <SelectItem value="ORDER_DEBIT">Paiement commande</SelectItem>
                  <SelectItem value="FX_LOSS">Perte FX</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tx-amount">Montant</Label>
              <Input
                id="tx-amount"
                type="number"
                min="0"
                step="0.01"
                value={txForm.amount}
                onChange={(event) => setTxForm((prev) => ({ ...prev, amount: event.target.value }))}
                placeholder={selectedAccount?.currency ?? "CNY"}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tx-fx">Taux FX</Label>
              <Input
                id="tx-fx"
                type="number"
                min="0"
                step="0.000001"
                value={txForm.fxRate}
                onChange={(event) => setTxForm((prev) => ({ ...prev, fxRate: event.target.value }))}
                placeholder="Optionnel"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-order">Commande</Label>
              <Input
                id="tx-order"
                value={txForm.orderId}
                onChange={(event) => setTxForm((prev) => ({ ...prev, orderId: event.target.value }))}
                placeholder="orderId optionnel"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tx-ref">Référence</Label>
            <Input
              id="tx-ref"
              value={txForm.reference}
              onChange={(event) => setTxForm((prev) => ({ ...prev, reference: event.target.value }))}
              placeholder="ALIPAY TOPUP 2026-03-26"
            />
          </div>

          <Button
            disabled={isPending || !accounts.length}
            onClick={() =>
              runAction(
                () =>
                  createTreasuryTransaction({
                    accountId: txForm.accountId,
                    type: txForm.type,
                    amount: txForm.amount,
                    fxRate: txForm.fxRate || undefined,
                    orderId: txForm.orderId || undefined,
                    reference: txForm.reference || undefined,
                  }),
                "Mouvement enregistré"
              )
            }
          >
            Enregistrer le mouvement
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
