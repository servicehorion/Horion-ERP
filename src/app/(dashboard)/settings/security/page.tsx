import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { TwoFactorSetup } from "@/components/settings/two-factor-setup";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SecuritySettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = (session.user as any).id as string;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorEnabled: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sécurité</h1>
        <p className="text-muted-foreground">Gérez les paramètres de sécurité de votre compte</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Authentification</CardTitle>
          <CardDescription>
            Renforcez la sécurité de votre compte avec une deuxième couche d'authentification.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <TwoFactorSetup twoFactorEnabled={user?.twoFactorEnabled ?? false} />
        </CardContent>
      </Card>
    </div>
  );
}
