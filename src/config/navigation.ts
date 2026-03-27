import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Search,
  Truck,
  DollarSign,
  ListTodo,
  Megaphone,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: number | "dot";
  children?: { title: string; href: string }[];
}

export const sidebarNavigation: NavItem[] = [
  {
    title: "Pilotage",
    href: "/pilotage",
    icon: LayoutDashboard,
    children: [
      { title: "Dashboard", href: "/dashboard" },
      { title: "Intelligence", href: "/pilotage/intelligence" },
      { title: "Decisions", href: "/pilotage/decisions" },
      { title: "Resources", href: "/pilotage/resources" },
      { title: "Risk Command", href: "/pilotage/risk" },
      { title: "Forecast", href: "/pilotage/forecast" },
    ],
  },
  {
    title: "Commandes",
    href: "/orders",
    icon: ShoppingCart,
    children: [
      { title: "Dashboard", href: "/orders" },
      { title: "Devis", href: "/quotes" },
      { title: "Nouveau", href: "/orders/new" },
      { title: "Pipeline Kanban", href: "/orders/board" },
      { title: "Compliance", href: "/orders/compliance" },
    ],
  },
  {
    title: "CRM",
    href: "/crm",
    icon: Users,
    children: [
      { title: "Dashboard", href: "/crm" },
      { title: "Intelligence", href: "/crm/intelligence" },
      { title: "Demandes", href: "/crm/demands" },
      { title: "Leads", href: "/crm/leads" },
      { title: "Contacts", href: "/contacts" },
      { title: "Analytics", href: "/crm/analytics" },
      { title: "Calendrier", href: "/crm/calendar" },
      { title: "Sources", href: "/crm/sources" },
      { title: "Sales Ops", href: "/crm/sales-ops" },
    ],
  },
  {
    title: "Sourcing",
    href: "/sourcing",
    icon: Search,
    children: [
      { title: "Tableau de bord", href: "/sourcing" },
      { title: "Cas de sourcing", href: "/sourcing/cases" },
      { title: "Prix Indicatif", href: "/sourcing/indicatif" },
      { title: "Catalogue Sourcing", href: "/sourcing/catalog" },
      { title: "Produits", href: "/catalog/products" },
      { title: "Fournisseurs", href: "/catalog/suppliers" },
      { title: "Offres", href: "/catalog/offers" },
      { title: "Vault", href: "/catalog/vault" },
      { title: "Groupage", href: "/sourcing/groupage" },
    ],
  },
  {
    title: "Logistique",
    href: "/logistics",
    icon: Truck,
    children: [
      { title: "Dashboard", href: "/logistics" },
      { title: "Controle qualite", href: "/qc" },
    ],
  },
  {
    title: "Finance",
    href: "/finance",
    icon: DollarSign,
    children: [
      { title: "Dashboard", href: "/finance" },
      { title: "Tresorerie & Wallets", href: "/finance/treasury" },
      { title: "Banques", href: "/finance/banks" },
      { title: "Paiements", href: "/finance/payments" },
      { title: "Approvals", href: "/finance/approvals" },
      { title: "Facturation", href: "/finance/invoices" },
      { title: "Marges", href: "/finance/margins" },
      { title: "P&L Analytique", href: "/finance/pnl" },
      { title: "Etats financiers", href: "/finance/statements" },
      { title: "Archive / Future", href: "/finance/archive" },
    ],
  },
  {
    title: "Taches & Projets",
    href: "/tasks",
    icon: ListTodo,
    children: [
      { title: "Dashboard Taches", href: "/tasks" },
      { title: "Mes Taches", href: "/tasks/my" },
      { title: "Kanban", href: "/tasks/board" },
      { title: "Gantt", href: "/tasks/gantt" },
      { title: "Timeline", href: "/tasks/timeline" },
      { title: "Analytics", href: "/tasks/analytics" },
      { title: "Templates", href: "/tasks/templates" },
      { title: "Calendrier", href: "/tasks/calendar" },
      { title: "Goals / OKRs", href: "/tasks/goals" },
      { title: "Recurrences", href: "/tasks/recurring" },
      { title: "Tous les projets", href: "/projects" },
    ],
  },
  {
    title: "Marketing",
    href: "/marketing",
    icon: Megaphone,
    children: [
      { title: "Dashboard", href: "/marketing" },
      { title: "WhatsApp", href: "/whatsapp" },
    ],
  },
  {
    title: "Parametres",
    href: "/settings",
    icon: Settings,
    children: [
      { title: "Equipe", href: "/settings/team" },
      { title: "Delegations", href: "/settings/delegation" },
      { title: "Agents IA", href: "/settings/agents" },
      { title: "Branding", href: "/settings/branding" },
      { title: "Audit Logs", href: "/settings/audit" },
      { title: "Regles Approvals", href: "/settings/approval-rules" },
      { title: "Securite (2FA)", href: "/settings/security" },
    ],
  },
];
