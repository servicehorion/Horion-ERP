"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Star,
  ChevronUp,
  ChevronDown,
  GitBranch,
  Loader2,
} from "lucide-react";
import {
  createPipeline,
  deletePipeline,
  setDefaultPipeline,
} from "@/lib/actions/crm-advanced.actions";
import { toast } from "sonner";

type PipelineStage = {
  id: string;
  name: string;
  order: number;
  color: string;
};

type Pipeline = {
  id: string;
  name: string;
  isDefault: boolean;
  stages: PipelineStage[];
  _count?: { leads?: number };
};

type Props = {
  pipelines: Pipeline[];
};

const PRESET_COLORS = [
  "#6366f1",
  "#3b82f6",
  "#8b5cf6",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#ec4899",
];

// ── Stage row in creation form ────────────────────────────────────────────────

function StageRow({
  stage,
  index,
  total,
  onUpdate,
  onRemove,
  onMove,
}: {
  stage: { name: string; color: string; order: number };
  index: number;
  total: number;
  onUpdate: (i: number, key: "name" | "color", val: string) => void;
  onRemove: (i: number) => void;
  onMove: (i: number, dir: "up" | "down") => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {/* Color picker */}
      <div className="flex gap-1">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`h-5 w-5 rounded-full border-2 transition-all ${stage.color === c ? "border-foreground scale-110" : "border-transparent"}`}
            style={{ backgroundColor: c }}
            onClick={() => onUpdate(index, "color", c)}
          />
        ))}
      </div>
      <Input
        value={stage.name}
        onChange={(e) => onUpdate(index, "name", e.target.value)}
        placeholder={`Étape ${index + 1}`}
        className="h-8 text-sm flex-1"
      />
      <div className="flex gap-0.5">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          disabled={index === 0}
          onClick={() => onMove(index, "up")}
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          disabled={index === total - 1}
          onClick={() => onMove(index, "down")}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-destructive"
          onClick={() => onRemove(index)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Create form ───────────────────────────────────────────────────────────────

function CreatePipelineForm({ onCreated }: { onCreated: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [stages, setStages] = useState([
    { name: "Nouveau", color: "#6366f1", order: 0 },
    { name: "Contacté", color: "#3b82f6", order: 1 },
    { name: "Qualifié", color: "#8b5cf6", order: 2 },
    { name: "Devis", color: "#f59e0b", order: 3 },
    { name: "Gagné", color: "#10b981", order: 4 },
  ]);

  function addStage() {
    setStages((prev) => [
      ...prev,
      { name: "", color: PRESET_COLORS[prev.length % PRESET_COLORS.length], order: prev.length },
    ]);
  }

  function updateStage(i: number, key: "name" | "color", val: string) {
    setStages((prev) => prev.map((s, idx) => (idx === i ? { ...s, [key]: val } : s)));
  }

  function removeStage(i: number) {
    setStages((prev) => prev.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, order: idx })));
  }

  function moveStage(i: number, dir: "up" | "down") {
    const j = dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= stages.length) return;
    const next = [...stages];
    [next[i], next[j]] = [next[j], next[i]];
    setStages(next.map((s, idx) => ({ ...s, order: idx })));
  }

  function handleCreate() {
    if (!name.trim()) { toast.error("Nom du pipeline requis"); return; }
    if (stages.some((s) => !s.name.trim())) { toast.error("Toutes les étapes doivent avoir un nom"); return; }

    startTransition(async () => {
      const res = await createPipeline({
        name: name.trim(),
        stages: stages.map((s, i) => ({ name: s.name, color: s.color, order: i })),
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Pipeline "${name}" créé`);
        setName("");
        onCreated();
        router.refresh();
      }
    });
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Nouveau pipeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom du pipeline (ex: Pipeline Enterprise)"
          className="h-8"
        />
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Étapes</p>
          {stages.map((s, i) => (
            <StageRow
              key={i}
              stage={s}
              index={i}
              total={stages.length}
              onUpdate={updateStage}
              onRemove={removeStage}
              onMove={moveStage}
            />
          ))}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs w-full"
            onClick={addStage}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Ajouter une étape
          </Button>
        </div>
        <Button
          size="sm"
          className="w-full"
          onClick={handleCreate}
          disabled={isPending}
        >
          {isPending ? (
            <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Création...</>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Créer le pipeline
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Pipeline card ─────────────────────────────────────────────────────────────

function PipelineCard({ pipeline }: { pipeline: Pipeline }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`Supprimer le pipeline "${pipeline.name}" ?`)) return;
    startTransition(async () => {
      const res = await deletePipeline(pipeline.id);
      if (res.error) toast.error(res.error);
      else { toast.success("Pipeline supprimé"); router.refresh(); }
    });
  }

  function handleSetDefault() {
    startTransition(async () => {
      const res = await setDefaultPipeline(pipeline.id);
      if (res.error) toast.error(res.error);
      else { toast.success(`"${pipeline.name}" défini comme pipeline par défaut`); router.refresh(); }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-violet-600" />
            {pipeline.name}
            {pipeline.isDefault && (
              <Badge className="bg-violet-100 text-violet-800 text-xs">
                <Star className="h-2.5 w-2.5 mr-0.5" />
                Défaut
              </Badge>
            )}
          </CardTitle>
          <div className="flex gap-1">
            {!pipeline.isDefault && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-muted-foreground"
                onClick={handleSetDefault}
                disabled={isPending}
              >
                <Star className="h-3.5 w-3.5 mr-1" />
                Définir défaut
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {pipeline.stages.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-xs text-muted-foreground">{s.name}</span>
              {i < pipeline.stages.length - 1 && (
                <span className="text-muted-foreground/40 text-xs">→</span>
              )}
            </div>
          ))}
        </div>
        {pipeline._count?.leads !== undefined && (
          <p className="text-xs text-muted-foreground mt-2">
            {pipeline._count.leads} lead(s) dans ce pipeline
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function PipelineManager({ pipelines }: Props) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {pipelines.length} pipeline(s) configuré(s)
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {showForm ? "Masquer" : "Nouveau pipeline"}
        </Button>
      </div>

      {showForm && (
        <CreatePipelineForm onCreated={() => setShowForm(false)} />
      )}

      {pipelines.length === 0 && !showForm ? (
        <div className="text-center py-10 text-muted-foreground">
          <GitBranch className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucun pipeline configuré.</p>
          <p className="text-xs mt-1">Créez votre premier pipeline pour organiser vos leads.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pipelines.map((p) => (
            <PipelineCard key={p.id} pipeline={p} />
          ))}
        </div>
      )}
    </div>
  );
}
