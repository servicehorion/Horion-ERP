import Link from "next/link";
import { Bot, FileClock, Palette, Shield, UserCog, Users, Workflow } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const items = [
  {
    title: "Equipe",
    href: "/settings/team",
    icon: Users,
    description: "Invitations, roles et activation des utilisateurs.",
  },
  {
    title: "Delegations",
    href: "/settings/delegation",
    icon: Workflow,
    description: "Regles de delegation et couverture des absences.",
  },
  {
    title: "Agents IA",
    href: "/settings/agents",
    icon: Bot,
    description: "Capabilities, runtime, handoffs et supervision des agents.",
  },
  {
    title: "Branding",
    href: "/settings/branding",
    icon: Palette,
    description: "Identite visuelle, devise et parametres tenant.",
  },
  {
    title: "Audit Logs",
    href: "/settings/audit",
    icon: FileClock,
    description: "Trace des actions, exports et evenements sensibles.",
  },
  {
    title: "Approvals",
    href: "/settings/approval-rules",
    icon: UserCog,
    description: "Regles multi-niveaux et governance d'approbation.",
  },
  {
    title: "Securite",
    href: "/settings/security",
    icon: Shield,
    description: "2FA, hygiene session et garde-fous de securite.",
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Parametres</h1>
        <p className="text-sm text-muted-foreground">
          Poste de controle des configurations critiques du tenant.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="h-full border-0 bg-muted/30 transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-sm">
                <CardHeader className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
