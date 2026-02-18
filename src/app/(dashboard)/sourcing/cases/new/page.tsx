import { SourcingCaseForm } from "@/components/sourcing/sourcing-case-form";
import { getOrdersForSourcing } from "@/lib/actions/sourcing.actions";

export const metadata = { title: "Nouveau cas de sourcing | Horion ERP" };

export default async function NewSourcingCasePage() {
  const ordersResult = await getOrdersForSourcing();
  const orders = ordersResult.data || [];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Nouveau cas de sourcing</h1>
        <p className="text-muted-foreground">
          Ouvrez un cas de sourcing pour lancer la recherche fournisseur
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          <p className="font-medium">Aucune commande éligible</p>
          <p className="text-sm mt-1">
            Les commandes en statut DEMANDE, RECHERCHE_PRODUIT ou SOURCING peuvent être associées à un cas de sourcing.
          </p>
        </div>
      ) : (
        <SourcingCaseForm orders={orders} />
      )}
    </div>
  );
}
