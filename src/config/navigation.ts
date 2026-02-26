import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Search,
  CheckSquare,
  Truck,
  DollarSign,
  FolderOpen,
  ListTodo,
  MessageCircle,
  Megaphone,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  children?: { title: string; href: string }[];
}

export const sidebarNavigation: NavItem[] = [
  {
    title: "Pilotage",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Commandes",
    href: "/orders",
    icon: ShoppingCart,
  },
  {
    title: "CRM",
    href: "/crm",
    icon: Users,
    children: [
      { title: "Dashboard", href: "/crm" },
      { title: "Intelligence", href: "/crm/intelligence" },
      { title: "Leads", href: "/crm/leads" },
      { title: "Contacts", href: "/contacts" },
    ],
  },
  {
    title: "Sourcing",
    href: "/sourcing",
    icon: Search,
  },
  {
    title: "Controle Qualite",
    href: "/qc",
    icon: CheckSquare,
  },
  {
    title: "Logistique",
    href: "/logistics",
    icon: Truck,
  },
  {
    title: "Finance",
    href: "/finance",
    icon: DollarSign,
    children: [
      { title: "Paiements", href: "/finance/payments" },
      { title: "Marges", href: "/finance/margins" },
    ],
  },
  {
    title: "Projets",
    href: "/projects",
    icon: FolderOpen,
  },
  {
    title: "Taches",
    href: "/tasks",
    icon: ListTodo,
    children: [
      { title: "Dashboard", href: "/tasks" },
      { title: "Mes Taches", href: "/tasks/my" },
      { title: "Kanban", href: "/tasks/board" },
      { title: "Gantt", href: "/tasks/gantt" },
      { title: "Timeline", href: "/tasks/timeline" },
      { title: "Analytics", href: "/tasks/analytics" },
      { title: "Templates", href: "/tasks/templates" },
    ],
  },
  {
    title: "WhatsApp",
    href: "/whatsapp",
    icon: MessageCircle,
  },
  {
    title: "Marketing",
    href: "/marketing",
    icon: Megaphone,
  },
  {
    title: "Parametres",
    href: "/settings",
    icon: Settings,
    children: [
      { title: "Equipe", href: "/settings/team" },
      { title: "Delegations", href: "/settings/delegation" },
    ],
  },
];
