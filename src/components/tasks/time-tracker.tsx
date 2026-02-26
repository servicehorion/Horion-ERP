"use client";

import { useRef, useState } from "react";
import { Clock, Loader2, Pause, Play, Plus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { logTaskTime } from "@/lib/actions/task.actions";
import { cn } from "@/lib/utils";

interface TimeTrackerProps {
  taskId: string;
  estimatedHours: number | null;
  actualHours: number | null;
}

export function TimeTracker({ taskId, estimatedHours, actualHours }: TimeTrackerProps) {
  const router = useRouter();
  const [showInput, setShowInput] = useState(false);
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerStartRef = useRef<number | null>(null);

  const estimated = estimatedHours ?? 0;
  const actual = actualHours ?? 0;
  const percent = estimated > 0 ? Math.min(100, Math.round((actual / estimated) * 100)) : 0;
  const overBudget = estimated > 0 && actual > estimated;

  // Timer functions
  const startTimer = () => {
    const now = Date.now();
    timerStartRef.current = now;
    setTimerStart(now);
    setTimerRunning(true);
    setElapsed(0);
    intervalRef.current = setInterval(() => {
      setElapsed(Date.now() - (timerStartRef.current ?? Date.now()));
    }, 1000);
  };

  const stopTimer = async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const start = timerStartRef.current;
    timerStartRef.current = null;
    if (!start) return;
    const elapsedMs = Date.now() - start;
    const elapsedHours = Math.round((elapsedMs / 3600000) * 100) / 100;
    setTimerRunning(false);
    setTimerStart(null);
    setElapsed(0);

    if (elapsedHours >= 0.01) {
      setLoading(true);
      try {
        const res = await logTaskTime(taskId, elapsedHours, "Timer automatique");
        if (res.error) toast.error(res.error);
        else {
          toast.success(`${elapsedHours}h enregistrées`);
          router.refresh();
        }
      } catch {
        toast.error("Erreur");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleManualLog = async () => {
    const h = parseFloat(hours);
    if (isNaN(h) || h <= 0) {
      toast.error("Entrez un nombre d'heures valide");
      return;
    }
    setLoading(true);
    try {
      const res = await logTaskTime(taskId, h, note.trim() || undefined);
      if (res.error) toast.error(res.error);
      else {
        toast.success(`${h}h enregistrées`);
        setHours("");
        setNote("");
        setShowInput(false);
        router.refresh();
      }
    } catch {
      toast.error("Erreur");
    } finally {
      setLoading(false);
    }
  };

  const formatElapsed = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    return `${h.toString().padStart(2, "0")}:${(m % 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Temps passé</span>
          <span className={cn("font-medium", overBudget ? "text-red-600" : "text-foreground")}>
            {actual}h{estimated > 0 ? ` / ${estimated}h` : ""}
            {overBudget && ` (+${(actual - estimated).toFixed(1)}h)`}
          </span>
        </div>
        {estimated > 0 && (
          <Progress
            value={percent}
            className={cn("h-2", overBudget && "[&>div]:bg-red-500")}
          />
        )}
      </div>

      {/* Timer */}
      {timerRunning ? (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="font-mono text-sm font-medium flex-1">
            {formatElapsed(elapsed)}
          </span>
          <Button size="sm" variant="outline" className="h-7" onClick={stopTimer} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pause className="h-3 w-3" />}
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8"
            onClick={startTimer}
          >
            <Play className="mr-1.5 h-3 w-3" />
            Démarrer chrono
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setShowInput(!showInput)}
          >
            <Plus className="mr-1.5 h-3 w-3" />
            Manuel
          </Button>
        </div>
      )}

      {/* Manual input */}
      {showInput && (
        <div className="space-y-2 p-2 border rounded-lg bg-muted/30">
          <div className="flex gap-2">
            <Input
              type="number"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="Heures"
              className="h-8 w-24 text-sm"
              min={0.1}
              step={0.25}
              autoFocus
            />
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (optionnel)"
              className="h-8 flex-1 text-sm"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" className="h-7" onClick={() => setShowInput(false)}>
              Annuler
            </Button>
            <Button size="sm" className="h-7" onClick={handleManualLog} disabled={loading}>
              {loading && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
