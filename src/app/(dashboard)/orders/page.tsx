export default function OrdersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Commandes</h1>
          <p className="text-muted-foreground">Gestion des commandes d'importation</p>
        </div>
      </div>
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        Aucune commande pour le moment. Le module Commandes sera implemente en Phase 1.
      </div>
    </div>
  );
}
