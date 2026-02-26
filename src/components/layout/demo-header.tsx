"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function DemoHeader() {
  return (
    <header data-slot="app-header" className="flex h-14 items-center gap-4 border-b bg-background px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />
      <div className="flex-1" />
      <Badge variant="secondary" className="font-medium">
        Demo mode
      </Badge>
      <Button variant="outline" size="sm" onClick={() => window.location.assign("/login")}>
        Connexion
      </Button>
    </header>
  );
}
