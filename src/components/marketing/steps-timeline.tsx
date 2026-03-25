import { cn } from "@/lib/utils";

interface Step {
  number: number;
  title: string;
  description: string;
  icon?: string;
}

interface StepsTimelineProps {
  steps: Step[];
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export function StepsTimeline({ steps, orientation = "vertical", className }: StepsTimelineProps) {
  if (orientation === "horizontal") {
    return (
      <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4", className)}>
        {steps.map((step, i) => (
          <div key={i} className="relative flex flex-col items-center text-center p-4 space-y-2">
            {/* Connector line */}
            {i < steps.length - 1 && (
              <div className="hidden lg:block absolute top-6 left-[60%] right-0 h-px bg-border" />
            )}
            {/* Number circle */}
            <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-sm">
              {step.icon ?? step.number}
            </div>
            <h3 className="font-semibold text-sm text-foreground leading-snug">{step.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-0", className)}>
      {steps.map((step, i) => (
        <div key={i} className="flex gap-4">
          {/* Left column: number + line */}
          <div className="flex flex-col items-center">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-sm">
              {step.icon ?? step.number}
            </div>
            {i < steps.length - 1 && (
              <div className="mt-1 flex-1 w-px bg-border min-h-[40px]" />
            )}
          </div>
          {/* Right column: content */}
          <div className="pb-8 pt-1.5 space-y-1">
            <h3 className="font-semibold text-foreground">{step.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
