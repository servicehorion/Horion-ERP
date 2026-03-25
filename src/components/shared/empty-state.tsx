import type { ReactNode } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

type EmptyStateAction = {
  label?: string;
  href?: string;
  node?: ReactNode;
};

interface EmptyStateProps {
  title?: string;
  description?: string;
  label?: string;
  icon?: ReactNode;
  action?: EmptyStateAction;
  actionLabel?: string;
  actionHref?: string;
}

export function EmptyState({
  title,
  description,
  label,
  icon,
  action,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  const resolvedTitle = title ?? label ?? "Aucune donnée";
  const resolvedAction = action?.node ? (
    action.node
  ) : action?.label && action.href ? (
    <Button asChild className="mt-4">
      <Link href={action.href}>
        <Plus className="mr-2 h-4 w-4" />
        {action.label}
      </Link>
    </Button>
  ) : actionLabel && actionHref ? (
    <Button asChild className="mt-4">
      <Link href={actionHref}>
        <Plus className="mr-2 h-4 w-4" />
        {actionLabel}
      </Link>
    </Button>
  ) : null;

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
      {icon ? (
        <div className="mb-4 text-muted-foreground opacity-30 [&_svg]:h-12 [&_svg]:w-12">
          {icon}
        </div>
      ) : null}
      <h3 className="text-lg font-medium text-foreground">{resolvedTitle}</h3>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      {resolvedAction}
    </div>
  );
}
