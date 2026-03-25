"use client";

import type { ReactNode } from "react";

interface CrmThemeProviderProps {
  children: ReactNode;
}

/**
 * Passthrough — the CRM module now uses the same global design system as the rest
 * of the app. No theme override is applied.
 */
export function CrmThemeProvider({ children }: CrmThemeProviderProps) {
  return <>{children}</>;
}
