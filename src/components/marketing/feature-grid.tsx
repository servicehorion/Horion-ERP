import { cn } from "@/lib/utils";

interface Feature {
  icon: string;
  title: string;
  description: string;
  variant?: "default" | "problem";
}

interface FeatureGridProps {
  features: Feature[];
  cols?: 2 | 3 | 4;
  className?: string;
}

const COLS_CLASS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export function FeatureGrid({ features, cols = 3, className }: FeatureGridProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-4", COLS_CLASS[cols], className)}>
      {features.map((feature, i) => (
        <div
          key={i}
          className={cn(
            "rounded-xl border p-5 space-y-3 transition-shadow hover:shadow-sm",
            feature.variant === "problem"
              ? "border-destructive/20 bg-destructive/5"
              : "border-border bg-card"
          )}
        >
          <span className="text-2xl">{feature.icon}</span>
          <h3 className="font-semibold text-foreground text-sm leading-snug">
            {feature.title}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {feature.description}
          </p>
        </div>
      ))}
    </div>
  );
}
