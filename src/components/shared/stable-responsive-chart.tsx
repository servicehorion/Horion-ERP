"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { ResponsiveContainer } from "recharts";

import { cn } from "@/lib/utils";

type StableResponsiveChartProps = {
  children: ReactNode;
  className?: string;
  minHeight?: number;
};

export function StableResponsiveChart({
  children,
  className,
  minHeight = 220,
}: StableResponsiveChartProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const update = () => {
      const { width, height } = host.getBoundingClientRect();
      setReady(width > 8 && height > 8);
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(host);

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={hostRef} className={cn("min-w-0 w-full", className)} style={{ minHeight }}>
      {ready ? <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer> : null}
    </div>
  );
}
