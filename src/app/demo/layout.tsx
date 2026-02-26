import type { ReactNode } from "react";

import { CrmThemeProvider } from "@/components/crm/crm-theme-provider";
import { DemoHeader } from "@/components/layout/demo-header";
import { DemoSidebar } from "@/components/layout/demo-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

export default function DemoLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <CrmThemeProvider>
      <SidebarProvider>
        <DemoSidebar />
        <SidebarInset>
          <DemoHeader />
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </CrmThemeProvider>
  );
}
