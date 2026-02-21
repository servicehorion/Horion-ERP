"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Keyboard, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const SHORTCUTS = [
  { keys: ["G", "T"], description: "Aller aux tâches" },
  { keys: ["G", "K"], description: "Aller au Kanban" },
  { keys: ["G", "G"], description: "Aller au Gantt" },
  { keys: ["G", "A"], description: "Aller à l'analytics" },
  { keys: ["G", "M"], description: "Aller à mes tâches" },
  { keys: ["G", "D"], description: "Aller au dashboard" },
  { keys: ["?"], description: "Afficher les raccourcis clavier" },
  { keys: ["Esc"], description: "Fermer / Retour" },
];

export function KeyboardShortcuts() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    function handleKeyDown(e: KeyboardEvent) {
      // Don't fire when typing in inputs/textareas
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (["input", "textarea", "select"].includes(tag)) return;
      if ((e.target as HTMLElement).isContentEditable) return;

      const key = e.key.toUpperCase();

      // ? → show shortcuts dialog
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        setOpen((prev) => !prev);
        return;
      }

      // Escape → close dialog
      if (e.key === "Escape") {
        setOpen(false);
        setPendingKey(null);
        return;
      }

      // G + <key> navigation chords
      if (key === "G" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setPendingKey("G");
        clearTimeout(timeout);
        timeout = setTimeout(() => setPendingKey(null), 1500);
        return;
      }

      if (pendingKey === "G") {
        clearTimeout(timeout);
        setPendingKey(null);
        switch (key) {
          case "T": router.push("/tasks"); break;
          case "K": router.push("/tasks/board"); break;
          case "G": router.push("/tasks/gantt"); break;
          case "A": router.push("/tasks/analytics"); break;
          case "M": router.push("/tasks/my"); break;
          case "D": router.push("/dashboard"); break;
        }
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timeout);
    };
  }, [pendingKey, router]);

  return (
    <>
      {/* Pending chord indicator */}
      {pendingKey && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background px-3 py-1.5 rounded-full text-sm font-mono flex items-center gap-2 shadow-lg">
          <kbd className="bg-background/20 rounded px-1">{pendingKey}</kbd>
          <span className="opacity-60">puis une touche...</span>
        </div>
      )}

      {/* Shortcuts button (bottom-right) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-background border rounded-full px-3 py-1.5 shadow-sm hover:shadow transition-all"
        title="Raccourcis clavier (?)"
      >
        <Keyboard className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Raccourcis</span>
      </button>

      {/* Shortcuts dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-4 w-4" />
              Raccourcis clavier
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-1">
            {SHORTCUTS.map((shortcut, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <span className="text-sm text-muted-foreground">{shortcut.description}</span>
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((k, j) => (
                    <span key={j} className="flex items-center gap-0.5">
                      <kbd className="inline-flex items-center px-1.5 py-0.5 rounded border bg-muted text-xs font-mono font-medium">
                        {k}
                      </kbd>
                      {j < shortcut.keys.length - 1 && (
                        <span className="text-muted-foreground text-[10px]">then</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <Badge variant="outline" className="text-xs">Navigation par chords: G + touche</Badge>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              <X className="h-4 w-4 mr-1" />
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
