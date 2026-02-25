"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

interface CrmThemeProviderProps {
  children: ReactNode;
}

export function CrmThemeProvider({ children }: CrmThemeProviderProps) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("crm-theme");
    return () => {
      root.classList.remove("crm-theme");
    };
  }, []);

  return <>{children}</>;
}
