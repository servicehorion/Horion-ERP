"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Settings2, Trash2, Loader2 } from "lucide-react";
import {
  updateLeadCustomFields,
  saveCustomFieldsSchema,
  type FieldDef,
} from "@/lib/actions/crm-advanced.actions";
import { toast } from "sonner";

type Props = {
  leadId: string;
  schema: FieldDef[];
  values: Record<string, unknown>;
  canAdmin?: boolean;
};

// ── Schema editor dialog ──────────────────────────────────────────────────────

function SchemaEditorDialog({
  schema,
  open,
  onOpenChange,
}: {
  schema: FieldDef[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fields, setFields] = useState<FieldDef[]>(schema);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<FieldDef["type"]>("text");

  function addField() {
    const key = newKey.trim().toLowerCase().replace(/\s+/g, "_");
    if (!key || !newLabel.trim()) return;
    if (fields.some((f) => f.key === key)) {
      toast.error("Ce clé existe déjà");
      return;
    }
    setFields((prev) => [...prev, { key, label: newLabel.trim(), type: newType, required: false }]);
    setNewKey("");
    setNewLabel("");
    setNewType("text");
  }

  function removeField(key: string) {
    setFields((prev) => prev.filter((f) => f.key !== key));
  }

  function save() {
    startTransition(async () => {
      const res = await saveCustomFieldsSchema("lead", fields);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Champs personnalisés mis à jour");
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurer les champs</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {/* Existing fields */}
          {fields.length > 0 && (
            <div className="space-y-2">
              {fields.map((f) => (
                <div
                  key={f.key}
                  className="flex items-center justify-between rounded border px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{f.label}</span>
                    <Badge variant="outline" className="ml-2 text-xs">
                      {f.type}
                    </Badge>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => removeField(f.key)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {/* Add new field */}
          <div className="border rounded p-3 space-y-2 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground">Ajouter un champ</p>
            <Input
              placeholder="Clé (ex: budget)"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
            />
            <Input
              placeholder="Label affiché (ex: Budget décisionnel)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
            <Select value={newType} onValueChange={(v) => setNewType(v as FieldDef["type"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Texte</SelectItem>
                <SelectItem value="number">Nombre</SelectItem>
                <SelectItem value="boolean">Oui / Non</SelectItem>
                <SelectItem value="date">Date</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="w-full" onClick={addField}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Ajouter
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={save} disabled={isPending}>
            {isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Field Row ─────────────────────────────────────────────────────────────────

function FieldRow({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (key: string, val: unknown) => void;
}) {
  if (field.type === "boolean") {
    return (
      <div className="flex items-center justify-between py-1.5">
        <Label className="text-sm font-normal">{field.label}</Label>
        <input
          type="checkbox"
          className="h-4 w-4 accent-violet-600"
          checked={Boolean(value)}
          onChange={(e) => onChange(field.key, e.target.checked)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{field.label}</Label>
      <Input
        type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
        value={String(value ?? "")}
        onChange={(e) => onChange(field.key, e.target.value)}
        className="h-8 text-sm"
        placeholder={`Saisir ${field.label.toLowerCase()}...`}
      />
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function LeadCustomFields({ leadId, schema, values, canAdmin }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [localValues, setLocalValues] = useState<Record<string, unknown>>(values);
  const [configOpen, setConfigOpen] = useState(false);
  const [dirty, setDirty] = useState(false);

  function handleChange(key: string, val: unknown) {
    setLocalValues((prev) => ({ ...prev, [key]: val }));
    setDirty(true);
  }

  function handleSave() {
    startTransition(async () => {
      const res = await updateLeadCustomFields(leadId, localValues);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Champs enregistrés");
        setDirty(false);
        router.refresh();
      }
    });
  }

  if (schema.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground space-y-3">
        <p className="text-sm">Aucun champ personnalisé configuré.</p>
        {canAdmin && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfigOpen(true)}
            >
              <Settings2 className="h-3.5 w-3.5 mr-1.5" />
              Configurer les champs
            </Button>
            <SchemaEditorDialog
              schema={schema}
              open={configOpen}
              onOpenChange={setConfigOpen}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{schema.length} champ(s) personnalisé(s)</p>
        {canAdmin && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setConfigOpen(true)}>
            <Settings2 className="h-3.5 w-3.5 mr-1" />
            Configurer
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {schema.map((f) => (
          <FieldRow
            key={f.key}
            field={f}
            value={localValues[f.key]}
            onChange={handleChange}
          />
        ))}
      </div>

      {dirty && (
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isPending}
          className="w-full"
        >
          {isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Enregistrement...
            </>
          ) : (
            "Enregistrer les champs"
          )}
        </Button>
      )}

      {canAdmin && (
        <SchemaEditorDialog
          schema={schema}
          open={configOpen}
          onOpenChange={setConfigOpen}
        />
      )}
    </div>
  );
}
