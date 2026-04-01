import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { ZeliaInternalWidget } from "@/components/assistant/zelia-internal-widget";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getNavBadges } from "@/lib/actions/navigation.actions";
import { getSession } from "@/lib/session";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const badgesPromise = getNavBadges();

  return <DashboardLayoutInner badgesPromise={badgesPromise}>{children}</DashboardLayoutInner>;
}

async function DashboardLayoutInner({
  children,
  badgesPromise,
}: {
  children: ReactNode;
  badgesPromise: ReturnType<typeof getNavBadges>;
}) {
  try {
    await getSession();
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("Session expiree") ||
        error.message.includes("Session indisponible"))
    ) {
      redirect("/login");
    }
    throw error;
  }

  const badges = await badgesPromise;

  return (
    <SidebarProvider>
      <AppSidebar badges={badges} />
      <SidebarInset>
        <Header />
        <main
          id="main-content"
          className="flex-1 overflow-auto p-3 sm:p-6 focus:outline-none"
          tabIndex={-1}
        >
          {children}
        </main>
        <ZeliaInternalWidget />
      </SidebarInset>
    </SidebarProvider>
  );
}
