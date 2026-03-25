import React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

type KpiVariant = "default" | "danger" | "success" | "warning";

const VARIANT_CARD: Record<KpiVariant, string> = {
  default: "border-0 bg-muted/40",
  danger: "border-0 surface-danger",
  success: "border-0 surface-success",
  warning: "border-0 surface-warning",
};

const VARIANT_VALUE: Record<KpiVariant, string> = {
  default: "",
  danger: "text-[var(--surface-danger-foreground)]",
  success: "text-[var(--surface-success-foreground)]",
  warning: "text-[var(--surface-warning-foreground)]",
};

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
  /** Any icon JSX element, e.g. <ShoppingCart className="h-4 w-4 text-muted-foreground" /> */
  icon?: React.ReactNode;
  /**
   * Semantic colour variant. Pass "danger" when the metric warrants attention.
   * Applies surface-danger CSS utility (background + foreground) from globals.css.
   */
  variant?: KpiVariant;
  /** Optional — wraps the whole card in a Link */
  href?: string;
  /** When true, shows a pulsing alert dot on the icon side */
  urgent?: boolean;
  className?: string;
}

/**
 * Unified KPI card — consistent across all modules.
 *
 * Usage:
 *   <KpiCard label="Commandes" value={42} sub="toutes commandes"
 *     icon={<ShoppingCart className="h-4 w-4 text-muted-foreground" />} />
 *
 *   <KpiCard label="Litiges" value={3} sub="à traiter"
 *     icon={<AlertTriangle className="h-4 w-4" />}
 *     variant={enLitige > 0 ? "danger" : "default"} />
 */
export function KpiCard({
  label,
  value,
  sub,
  icon,
  variant = "default",
  href,
  urgent,
  className,
  style,
}: KpiCardProps & { style?: React.CSSProperties }) {
  const inner = (
    <Card
      style={style}
      className={cn(
        VARIANT_CARD[variant],
        "animate-fade-in transition-shadow hover:shadow-sm",
        href && "cursor-pointer",
        className,
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </span>
          <div className="flex items-center gap-1">
            {urgent && (
              <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
            )}
            {icon}
          </div>
        </div>
        <p className={cn("text-2xl font-bold tabular-nums leading-none mt-2", VARIANT_VALUE[variant])}>
          {value}
        </p>
        {sub && (
          <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>
        )}
      </CardContent>
    </Card>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}

/** Convenience grid wrapper — 2 cols on mobile, N cols on desktop */
interface KpiGridProps {
  cols?: 2 | 3 | 4 | 5 | 6 | 7;
  children: React.ReactNode;
  className?: string;
}

const COLS_CLASS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-4",
  5: "grid-cols-2 md:grid-cols-5",
  6: "grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
  7: "grid-cols-2 sm:grid-cols-4 lg:grid-cols-7",
};

export function KpiGrid({ cols = 4, children, className }: KpiGridProps) {
  return (
    <div className={cn("grid gap-3", COLS_CLASS[cols], className)}>
      {React.Children.map(children, (child, index) => {
        if (!React.isValidElement(child)) return child;
        return React.cloneElement(child as React.ReactElement<{ style?: React.CSSProperties }>, {
          style: { animationDelay: `${index * 80}ms`, ...(child as React.ReactElement<{ style?: React.CSSProperties }>).props.style },
        });
      })}
    </div>
  );
}
