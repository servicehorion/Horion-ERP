"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  addChecklistItem,
  toggleChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
} from "@/lib/actions/task.actions";

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  position: number;
}

interface TaskChecklistProps {
  taskId: string;
  items?: ChecklistItem[];
}

export function TaskChecklist({ taskId, items: initialItems = [] }: TaskChecklistProps) {
  const [items, setItems] = useState<ChecklistItem[]>(initialItems);
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.position - b.position),
    [items]
  );
  const completed = sorted.filter((i) => i.checked).length;
  const progress = sorted.length > 0 ? Math.round((completed / sorted.length) * 100) : 0;

  const handleAdd = async () => {
    const text = newText.trim();
    if (!text) return;
    const res = await addChecklistItem(taskId, text);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setItems((prev) => [...prev, res.data as ChecklistItem]);
    setNewText("");
  };

  const handleToggle = async (id: string) => {
    const res = await toggleChecklistItem(id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
  };

  const startEdit = (item: ChecklistItem) => {
    setEditingId(item.id);
    setEditingText(item.text);
  };

  const commitEdit = async () => {
    if (!editingId) return;
    const text = editingText.trim();
    if (!text) return;
    const res = await updateChecklistItem(editingId, { text });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === editingId ? { ...i, text } : i)));
    setEditingId(null);
    setEditingText("");
  };

  const handleDelete = async (id: string) => {
    const res = await deleteChecklistItem(id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Checklist</span>
        <span className="text-muted-foreground">
          {completed}/{sorted.length} ({progress}%)
        </span>
      </div>
      <Progress value={progress} className="h-2" />

      <div className="space-y-2">
        {sorted.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun element</p>
        )}
        {sorted.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <Checkbox checked={item.checked} onCheckedChange={() => handleToggle(item.id)} />
            {editingId === item.id ? (
              <Input
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEdit();
                  if (e.key === "Escape") {
                    setEditingId(null);
                    setEditingText("");
                  }
                }}
                onBlur={commitEdit}
                className="h-8"
              />
            ) : (
              <button
                type="button"
                className={`flex-1 text-left text-sm ${item.checked ? "line-through text-muted-foreground" : ""}`}
                onClick={() => startEdit(item)}
              >
                {item.text}
              </button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(item)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(item.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Input
          placeholder="Ajouter un element..."
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          className="h-8"
        />
        <Button size="sm" onClick={handleAdd} className="h-8">
          <Plus className="h-4 w-4 mr-1" />
          Ajouter
        </Button>
      </div>
    </div>
  );
}
