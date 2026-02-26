import { LayoutDashboard, Users, Target, FileText } from "lucide-react";
import type { NavItem } from "@/config/navigation";

export const demoNavigation: NavItem[] = [
  {
    title: "Apercu",
    href: "/demo",
    icon: LayoutDashboard,
  },
  {
    title: "CRM",
    href: "/demo#crm",
    icon: Users,
    children: [
      { title: "Dashboard", href: "/demo#crm-dashboard" },
      { title: "Leads", href: "/demo#leads" },
      { title: "Pipeline", href: "/demo#pipeline" },
    ],
  },
  {
    title: "Leads",
    href: "/demo#leads",
    icon: Target,
  },
  {
    title: "Contact",
    href: "/demo#contact",
    icon: FileText,
  },
];
