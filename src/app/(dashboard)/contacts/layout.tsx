import type { ReactNode } from "react";

import { CrmThemeProvider } from "@/components/crm/crm-theme-provider";

export default function ContactsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <CrmThemeProvider>{children}</CrmThemeProvider>;
}
