"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { sidebarNavigation } from "@/config/navigation";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BrandLogo } from "@/components/layout/brand-logo";
import { ChevronRight } from "lucide-react";

function SidebarBadge({ value }: { value?: number | "dot" }) {
  if (!value) return null;

  return value === "dot" ? (
    <span className="ml-auto inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
  ) : (
    <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground">
      {value > 99 ? "99+" : value}
    </span>
  );
}

export function AppSidebar({ badges = {} }: { badges?: Record<string, number | "dot"> }) {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-6 py-4">
        <Link href="/dashboard" className="flex items-center gap-3">
          <BrandLogo width={132} height={32} priority className="max-w-[132px]" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {sidebarNavigation.map((item) => {
                const hasActiveChild =
                  item.children?.some(
                    (child) => pathname === child.href || pathname.startsWith(child.href + "/")
                  ) ?? false;
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href + "/") || hasActiveChild;
                const Icon = item.icon;
                const badge = badges[item.href] ?? item.badge;

                if (item.children) {
                  return (
                    <Collapsible key={item.href} defaultOpen={isActive}>
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton className={cn(isActive && "bg-accent")}>
                            <Icon className="h-4 w-4" />
                            <span>{item.title}</span>
                            <SidebarBadge value={badge} />
                            <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item.children.map((child) => (
                              <SidebarMenuSubItem key={`${item.href}:${child.href}:${child.title}`}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={
                                    pathname === child.href || pathname.startsWith(child.href + "/")
                                  }
                                >
                                  <Link href={child.href}>{child.title}</Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.href}>
                        <Icon className="h-4 w-4" />
                        <span>{item.title}</span>
                        <SidebarBadge value={badge} />
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
