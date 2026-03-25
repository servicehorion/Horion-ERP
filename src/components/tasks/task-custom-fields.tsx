"use client";

import { useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateTaskCustomFields } from "@/lib/actions/task.actions";

const TYPE_OPTIONS = ["text", "number", "date", "boolean", "select"] as const;

type FieldType = (typeof TYPE_OPTIONS)[number];

interface FieldRow {
  key: string;
  type: FieldType;
  value: any;
}

interface TaskCustomFieldsProps {
  taskId: string;
  initialFields?: Record<string, unknown> | null;
}

function detectType(value: unknown): FieldType {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return "date";
  return "text";
}

export function TaskCustomFields({ taskId, initialFields }: TaskCustomFieldsProps) {
  const initialRows = useMemo(() => {
    const rows: FieldRow[] = [];
    if (initialFields) {
      Object.entries(initialFields).forEach(([k, v]) => {
        rows.push({ key: k, type: detectType(v), value: v as any });
      });
    }
    return rows;
  }, [initialFields]);

  const [rows, setRows] = useState<FieldRow[]>(initialRows);
  const [saving, setSaving] = useState(false);

  const addRow = () => setRows((prev) => [...prev, { key: "", type: "text", value: "" }]);

  const removeRow = (index: number) => setRows((prev) => prev.filter((_, i) => i !== index));

  const updateRow = (index: number, updates: Partial<FieldRow>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...updates } : row)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      rows.forEach((row) => {
        const key = row.key.trim();
        if (!key) return;
        switch (row.type) {
          case "number":
            payload[key] = row.value === "" ? 0 : Number(row.value);
            break;
          case "boolean":
            payload[key] = Boolean(row.value);
            break;
          case "date":
            payload[key] = row.value ? String(row.value) : "";
            break;
          default:
            payload[key] = row.value ?? "";
        }
      });

      const res = await updateTaskCustomFields(taskId, payload);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Champs personnalises mis a jour");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">Aucun champ personnalise</p>
      )}
      {rows.map((row, index) => (
        <div key={`row-${index}`} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
          <Input
            placeholder="Cle"
            value={row.key}
            onChange={(e) => updateRow(index, { key: e.target.value })}
          />
          <Select
            value={row.type}
            onValueChange={(value) => updateRow(index, { type: value as FieldType })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {row.type === "boolean" ? (
            <Select
              value={row.value ? "true" : "false"}
              onValueChange={(value) => updateRow(index, { value: value === "true" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">true</SelectItem>
                <SelectItem value="false">false</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Input
              type={row.type === "number" ? "number" : row.type === "date" ? "date" : "text"}
              value={row.value ?? ""}
              onChange={(e) => updateRow(index, { value: e.target.value })}
              placeholder="Valeur"
            />
          )}
          <Button variant="ghost" size="icon" onClick={() => removeRow(index)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Ajouter un champ
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="h-3.5 w-3.5 mr-1" />
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
