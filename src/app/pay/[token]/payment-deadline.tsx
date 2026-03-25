"use client";

import { useEffect, useMemo, useState } from "react";

function formatRemaining(ms: number) {
  if (ms <= 0) return "Delai depasse";

  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}j`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}min`);
  return parts.slice(0, 3).join(" ");
}

export function PaymentDeadline({ expiresAt }: { expiresAt: string }) {
  const expiry = useMemo(() => new Date(expiresAt).getTime(), [expiresAt]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(interval);
  }, []);

  const remaining = expiry - now;
  const tone = remaining <= 0 ? "text-rose-700" : remaining < 8 * 3600000 ? "text-amber-700" : "text-slate-700";

  return <span className={tone}>{formatRemaining(remaining)}</span>;
}
