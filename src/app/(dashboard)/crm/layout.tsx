import type { ReactNode } from "react";

import { CrmThemeProvider } from "@/components/crm/crm-theme-provider";

export default function CrmLayout({ children }: { children: ReactNode }) {
  return <CrmThemeProvider>{children}</CrmThemeProvider>;
}
