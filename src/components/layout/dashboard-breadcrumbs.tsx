"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useMemo } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { sidebarNavigation } from "@/config/navigation";

const DYNAMIC_ID = /^[a-z0-9]{10,}$/i;

function titleCase(value: string): string {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildPathLabelMap(): Record<string, string> {
  const map: Record<string, string> = {
    "/dashboard": "Dashboard",
  };

  for (const module of sidebarNavigation) {
    map[module.href] = module.title;
    for (const child of module.children ?? []) {
      map[child.href] = child.title;
    }
  }

  return map;
}

const PATH_LABELS = buildPathLabelMap();

export function DashboardBreadcrumbs() {
  const pathname = usePathname();

  const crumbs = useMemo(() => {
    if (!pathname) return [];
    const segments = pathname.split("/").filter(Boolean);
    const out: Array<{ href: string; label: string }> = [{ href: "/dashboard", label: "Dashboard" }];

    let running = "";
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      running += `/${segment}`;

      const explicit = PATH_LABELS[running];
      const label =
        explicit ??
        (DYNAMIC_ID.test(segment)
          ? "Detail"
          : titleCase(segment));

      if (out[out.length - 1]?.href !== running) {
        out.push({ href: running, label });
      }
    }

    return out;
  }, [pathname]);

  if (crumbs.length <= 1) return null;

  return (
    <Breadcrumb className="hidden md:block">
      <BreadcrumbList>
        {crumbs.map((crumb, idx) => {
          const last = idx === crumbs.length - 1;
          return (
            <Fragment key={crumb.href}>
              <BreadcrumbItem>
                {last ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!last ? <BreadcrumbSeparator /> : null}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
