"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Command, Search, Star, X } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { sidebarNavigation } from "@/config/navigation";
import { cn } from "@/lib/utils";

type PaletteItem = {
  title: string;
  href: string;
  section: string;
  keywords: string;
};

const RECENT_KEY = "horion:recent-pages";
const FAVORITES_KEY = "horion:favorites";

function flattenNavigation(): PaletteItem[] {
  const out: PaletteItem[] = [];
  for (const module of sidebarNavigation) {
    out.push({
      title: module.title,
      href: module.href,
      section: "Modules",
      keywords: `${module.title} ${module.href}`,
    });

    for (const child of module.children ?? []) {
      out.push({
        title: `${module.title} - ${child.title}`,
        href: child.href,
        section: module.title,
        keywords: `${module.title} ${child.title} ${child.href}`,
      });
    }
  }

  const dedup = new Map<string, PaletteItem>();
  for (const item of out) {
    if (!dedup.has(item.href)) dedup.set(item.href, item);
  }
  return Array.from(dedup.values());
}

function readLocalArray(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeLocalArray(key: string, value: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [shortcutLabel, setShortcutLabel] = useState("Ctrl+K");

  const items = useMemo(() => flattenNavigation(), []);
  const itemsByHref = useMemo(() => new Map(items.map((item) => [item.href, item])), [items]);

  const recentItems = useMemo(
    () => recent.map((href) => itemsByHref.get(href)).filter((item): item is PaletteItem => Boolean(item)),
    [recent, itemsByHref]
  );

  const favoriteItems = useMemo(
    () => favorites.map((href) => itemsByHref.get(href)).filter((item): item is PaletteItem => Boolean(item)),
    [favorites, itemsByHref]
  );

  const isCurrentFavorite = favorites.includes(pathname);

  useEffect(() => {
    setRecent(readLocalArray(RECENT_KEY));
    setFavorites(readLocalArray(FAVORITES_KEY));
    if (typeof navigator !== "undefined" && navigator.platform.includes("Mac")) {
      setShortcutLabel("Cmd+K");
    }
  }, []);

  useEffect(() => {
    if (!pathname || !pathname.startsWith("/")) return;

    setRecent((prev) => {
      const next = [pathname, ...prev.filter((p) => p !== pathname)].slice(0, 8);
      writeLocalArray(RECENT_KEY, next);
      return next;
    });
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement).tagName.toLowerCase();
      const isTypingTarget = ["input", "textarea", "select"].includes(tag) || (event.target as HTMLElement).isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((state) => !state);
        return;
      }

      if (isTypingTarget) return;

      if (event.altKey && !event.metaKey && !event.ctrlKey) {
        const quick: Record<string, string> = {
          "1": "/dashboard",
          "2": "/orders",
          "3": "/crm",
          "4": "/sourcing",
          "5": "/tasks",
        };
        const target = quick[event.key];
        if (target) {
          event.preventDefault();
          router.push(target);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  const navigate = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const toggleFavorite = () => {
    if (!pathname.startsWith("/")) return;
    setFavorites((prev) => {
      const next = prev.includes(pathname) ? prev.filter((href) => href !== pathname) : [pathname, ...prev].slice(0, 12);
      writeLocalArray(FAVORITES_KEY, next);
      return next;
    });
  };

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="interactive-soft interactive-press h-8 w-[220px] justify-start text-muted-foreground"
          onClick={() => setOpen(true)}
          aria-label="Open command palette"
        >
          <Search className="h-4 w-4" />
          <span className="truncate">Search pages...</span>
          <kbd className="ml-auto hidden rounded border px-1.5 py-0.5 text-[10px] font-medium md:inline-flex">{shortcutLabel}</kbd>
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleFavorite}
          aria-label={isCurrentFavorite ? "Remove from favorites" : "Add to favorites"}
          className={cn(isCurrentFavorite && "text-amber-500")}
        >
          <Star className={cn("h-4 w-4", isCurrentFavorite && "fill-current")} />
          <span className="sr-only">{isCurrentFavorite ? "Remove from favorites" : "Add to favorites"}</span>
        </Button>
      </div>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Command Palette"
        description="Fast Horion navigation"
        className="max-w-2xl"
      >
        <CommandInput placeholder="Rechercher une page, un module, un mot-clé..." />
        <CommandList>
          <CommandEmpty>Aucun résultat.</CommandEmpty>

          {favoriteItems.length > 0 && (
            <CommandGroup heading="Favoris">
              {favoriteItems.map((item) => (
                <CommandItem key={`fav-${item.href}`} onSelect={() => navigate(item.href)} value={`${item.title} ${item.keywords}`}>
                  <Star className="h-4 w-4 fill-current text-amber-500" />
                  <span>{item.title}</span>
                  <CommandShortcut>Fav</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {recentItems.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Récents">
                {recentItems.map((item) => (
                  <CommandItem key={`recent-${item.href}`} onSelect={() => navigate(item.href)} value={`${item.title} ${item.keywords}`}>
                    <Command className="h-4 w-4" />
                    <span>{item.title}</span>
                    <CommandShortcut>{item.section}</CommandShortcut>
                  </CommandItem>
                ))}
                <CommandItem
                  onSelect={() => {
                    setRecent([]);
                    writeLocalArray(RECENT_KEY, []);
                  }}
                >
                  <X className="h-4 w-4" />
                  <span>Effacer l'historique</span>
                </CommandItem>
              </CommandGroup>
            </>
          )}

          <CommandSeparator />
          <CommandGroup heading="Navigation">
            {items.map((item) => (
              <CommandItem key={item.href} onSelect={() => navigate(item.href)} value={`${item.title} ${item.keywords}`}>
                <span>{item.title}</span>
                <CommandShortcut>{item.section}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
