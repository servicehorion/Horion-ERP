import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Action buttons / controls rendered on the right */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Unified page header — consistent across all modules.
 *
 * Usage:
 *   <PageHeader title="Commandes" description="Gestion des commandes d'importation">
 *     <Button asChild><Link href="/orders/new"><Plus />Nouvelle commande</Link></Button>
 *   </PageHeader>
 */
export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 flex-wrap", className)}>
      <div className="min-w-0">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {children}
        </div>
      )}
    </div>
  );
}
