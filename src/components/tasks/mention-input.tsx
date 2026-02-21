"use client";

import { useState, useRef, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onMentionsChange: (mentionedIds: string[]) => void;
  teamMembers: { id: string; name: string }[];
  placeholder?: string;
  rows?: number;
  className?: string;
}

export function MentionInput({
  value,
  onChange,
  onMentionsChange,
  teamMembers,
  placeholder = "Ajouter un commentaire... (@nom pour mentionner)",
  rows = 3,
  className,
}: MentionInputProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [query, setQuery] = useState("");
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionedIds, setMentionedIds] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filtered = query
    ? teamMembers.filter((m) => m.name.toLowerCase().startsWith(query.toLowerCase()))
    : teamMembers.slice(0, 5);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (showDropdown) {
        if (e.key === "Escape") {
          setShowDropdown(false);
          setMentionStart(null);
        }
      }
    },
    [showDropdown]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      onChange(text);

      const cursorPos = e.target.selectionStart;
      const textBefore = text.slice(0, cursorPos);
      const atIndex = textBefore.lastIndexOf("@");

      if (atIndex !== -1 && (atIndex === 0 || /\s/.test(textBefore[atIndex - 1]))) {
        const potentialQuery = textBefore.slice(atIndex + 1);
        if (!potentialQuery.includes(" ")) {
          setMentionStart(atIndex);
          setQuery(potentialQuery);
          setShowDropdown(true);
          return;
        }
      }

      setShowDropdown(false);
      setMentionStart(null);
      setQuery("");
    },
    [onChange]
  );

  const selectMember = useCallback(
    (member: { id: string; name: string }) => {
      if (mentionStart === null) return;

      const before = value.slice(0, mentionStart);
      const after = value.slice(mentionStart + 1 + query.length);
      const newText = `${before}@${member.name} ${after}`;

      onChange(newText);

      const newIds = mentionedIds.includes(member.id)
        ? mentionedIds
        : [...mentionedIds, member.id];
      setMentionedIds(newIds);
      onMentionsChange(newIds);

      setShowDropdown(false);
      setMentionStart(null);
      setQuery("");

      // Restore focus
      setTimeout(() => textareaRef.current?.focus(), 0);
    },
    [mentionStart, value, query, mentionedIds, onChange, onMentionsChange]
  );

  // Extract currently mentioned names from text to show badge strip
  const activeMentions = mentionedIds.filter((id) => {
    const member = teamMembers.find((m) => m.id === id);
    return member && value.includes(`@${member.name}`);
  });

  return (
    <div className="relative space-y-1.5">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={cn("resize-none", className)}
      />

      {/* @mention dropdown */}
      {showDropdown && filtered.length > 0 && (
        <div className="absolute z-50 w-64 bg-popover border rounded-md shadow-md p-1 text-sm">
          <p className="px-2 py-1 text-xs text-muted-foreground font-medium">Membres de l&apos;équipe</p>
          {filtered.map((m) => (
            <button
              key={m.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // prevent textarea blur
                selectMember(m);
              }}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-accent transition-colors text-left"
            >
              <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
                {m.name.charAt(0).toUpperCase()}
              </span>
              {m.name}
            </button>
          ))}
        </div>
      )}

      {/* Active mention badges */}
      {activeMentions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {activeMentions.map((id) => {
            const member = teamMembers.find((m) => m.id === id);
            return member ? (
              <Badge key={id} variant="secondary" className="text-xs">
                @{member.name}
              </Badge>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}
