import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Accès refusé | Horion ERP" };

export default function UnauthorizedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center p-6">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-50">
        <ShieldOff className="h-8 w-8 text-red-500" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Accès refusé</h1>
        <p className="text-muted-foreground max-w-sm">
          Vous n&apos;avez pas les droits nécessaires pour accéder à cette
          section. Contactez votre administrateur si vous pensez qu&apos;il
          s&apos;agit d&apos;une erreur.
        </p>
      </div>

      <div className="flex gap-3">
        <Button asChild variant="outline">
          <Link href="/dashboard">Retour au dashboard</Link>
        </Button>
        <Button asChild>
          <Link href="/tasks">Mes tâches</Link>
        </Button>
      </div>
    </div>
  );
}
