import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { CompanionShortcut } from "@/App";
import { Keyboard, Plus, Trash2, Edit3, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompanionShortcutsSectionProps {
  companionShortcuts: CompanionShortcut[];
  onCompanionShortcutsChange: (shortcuts: CompanionShortcut[]) => void;
}

interface Draft {
  label: string;
  keys: string;
  trigger: "start" | "stop" | "both";
  pendingKeys: string[];
}

const TRIGGER_LABELS: Record<string, string> = {
  start: "Demarrage",
  stop: "Arret",
  both: "Les deux",
};

export default function CompanionShortcutsSection({
  companionShortcuts,
  onCompanionShortcutsChange,
}: CompanionShortcutsSectionProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const captureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingId && captureRef.current) {
      captureRef.current.focus();
    }
  }, [editingId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const keys: string[] = [];
    if (e.ctrlKey) keys.push("Ctrl");
    if (e.shiftKey) keys.push("Shift");
    if (e.altKey) keys.push("Alt");
    if (e.metaKey) keys.push("Win");

    const key = e.key;
    const modifierKeys = ["Control", "Shift", "Alt", "Meta"];

    if (!modifierKeys.includes(key)) {
      const keyMap: Record<string, string> = {
        " ": "Space",
        Enter: "Enter",
        Tab: "Tab",
        Escape: "Escape",
        Backspace: "Backspace",
        Delete: "Delete",
        ArrowUp: "Up",
        ArrowDown: "Down",
        ArrowLeft: "Left",
        ArrowRight: "Right",
      };

      if (keyMap[key]) {
        keys.push(keyMap[key]);
      } else if (key.startsWith("F") && key.length <= 3) {
        keys.push(key);
      } else if (key.length === 1) {
        keys.push(key.toUpperCase());
      }
    }

    if (draft) {
      setDraft({ ...draft, pendingKeys: keys });
    }
  };

  const startEdit = async (companion: CompanionShortcut) => {
    await invoke("disable_shortcuts");
    setEditingId(companion.id);
    setDraft({
      label: companion.label,
      keys: companion.keys,
      trigger: companion.trigger,
      pendingKeys: [],
    });
  };

  const cancelEdit = async () => {
    setEditingId(null);
    setDraft(null);
    await invoke("enable_shortcuts");
  };

  const saveEdit = async () => {
    if (!editingId || !draft) return;

    const finalKeys =
      draft.pendingKeys.length >= 2 ? draft.pendingKeys.join("+") : draft.keys;

    const updated = companionShortcuts.map((c) =>
      c.id === editingId
        ? { ...c, label: draft.label, keys: finalKeys, trigger: draft.trigger }
        : c
    );
    onCompanionShortcutsChange(updated);
    setEditingId(null);
    setDraft(null);
    await invoke("enable_shortcuts");
  };

  return (
    <div className="p-5 rounded-xl border border-border-card bg-surface-raised space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
          <Keyboard className="h-4 w-4" />
          Raccourcis compagnons
        </div>
        <button
          onClick={() => {
            const newCompanion: CompanionShortcut = {
              id: crypto.randomUUID(),
              label: "",
              keys: "",
              trigger: "both",
            };
            onCompanionShortcutsChange([...companionShortcuts, newCompanion]);
            startEdit(newCompanion);
          }}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border-card text-muted-foreground hover:text-foreground hover:border-border-hover transition-colors"
        >
          <Plus size={14} className="inline mr-1" />
          Ajouter
        </button>
      </div>

      <p className="text-sm text-muted-foreground">
        Envoyer des raccourcis clavier a d'autres applications au demarrage ou a
        l'arret de l'enregistrement (ex: muter Discord, Teams).
      </p>

      {companionShortcuts.length === 0 ? (
        <div className="p-4 rounded-lg border border-dashed border-border-subtle text-center">
          <p className="text-sm text-muted-foreground">
            Aucun raccourci compagnon configure.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {companionShortcuts.map((companion) => {
            const isEditing = editingId === companion.id;
            const keyParts = companion.keys
              ? companion.keys.split("+")
              : [];

            if (isEditing && draft) {
              const displayKeys =
                draft.pendingKeys.length > 0
                  ? draft.pendingKeys
                  : draft.keys
                    ? draft.keys.split("+")
                    : [];

              return (
                <div
                  key={companion.id}
                  className="p-3 rounded-lg border-2 border-[var(--color-active)] bg-surface-inset space-y-3"
                >
                  {/* Row 1: trigger + key capture + label */}
                  <div className="flex items-center gap-2">
                    {/* Trigger buttons */}
                    <div className="flex shrink-0">
                      {(["start", "stop", "both"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setDraft({ ...draft, trigger: t })}
                          className={cn(
                            "px-2 py-1 text-[11px] font-medium transition-colors first:rounded-l-md last:rounded-r-md border",
                            draft.trigger === t
                              ? "bg-[var(--color-active)]/15 text-[var(--color-active)] border-[var(--color-active)]/30 z-10"
                              : "border-border-card text-muted-foreground hover:text-foreground -ml-px"
                          )}
                        >
                          {TRIGGER_LABELS[t]}
                        </button>
                      ))}
                    </div>

                    {/* Key capture */}
                    <div
                      ref={captureRef}
                      tabIndex={0}
                      onKeyDown={handleKeyDown}
                      className="flex gap-1.5 items-center min-h-[32px] min-w-[120px] px-2.5 py-1 rounded-md border border-[var(--color-active)]/50 bg-surface-deep focus:outline-none focus:ring-2 focus:ring-[var(--color-active)]/30"
                    >
                      {displayKeys.length > 0 ? (
                        displayKeys.map((key, i) => (
                          <kbd key={i} className="text-[11px] px-1.5 py-0.5">
                            {key}
                          </kbd>
                        ))
                      ) : (
                        <span className="text-[11px] text-muted-foreground">
                          Touches...
                        </span>
                      )}
                    </div>

                    {/* Label */}
                    <input
                      type="text"
                      value={draft.label}
                      onChange={(e) =>
                        setDraft({ ...draft, label: e.target.value })
                      }
                      placeholder="Nom"
                      className="flex-1 px-2.5 py-1 rounded-md bg-surface-deep border border-border-card text-sm text-foreground input-glow placeholder:text-muted/50 min-w-0"
                    />
                  </div>

                  {/* Row 2: save / cancel / delete */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={saveEdit}
                      className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md bg-[var(--color-active)] text-background hover:bg-[var(--color-active)]/90 transition-colors"
                    >
                      <Check className="h-3 w-3" />
                      Enregistrer
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md border border-border text-muted-foreground hover:bg-surface-active transition-colors"
                    >
                      <X className="h-3 w-3" />
                      Annuler
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={() => {
                        const updated = companionShortcuts.filter(
                          (c) => c.id !== companion.id
                        );
                        onCompanionShortcutsChange(updated);
                        setEditingId(null);
                        setDraft(null);
                        invoke("enable_shortcuts");
                      }}
                      className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            }

            /* View mode — single compact row */
            return (
              <div
                key={companion.id}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border-card bg-surface-inset"
              >
                {/* Trigger badge */}
                <span className="shrink-0 px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--color-active)]/10 text-[var(--color-active)] border border-[var(--color-active)]/20">
                  {TRIGGER_LABELS[companion.trigger]}
                </span>

                {/* Keys */}
                {keyParts.length > 0 ? (
                  <div className="flex gap-1 shrink-0">
                    {keyParts.map((key, i) => (
                      <kbd key={i} className="text-[11px] px-1.5 py-0.5">
                        {key}
                      </kbd>
                    ))}
                  </div>
                ) : (
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    Non assigne
                  </span>
                )}

                {/* Label */}
                <span className="flex-1 text-sm text-foreground truncate min-w-0">
                  {companion.label || (
                    <span className="text-muted-foreground">Sans nom</span>
                  )}
                </span>

                {/* Edit */}
                <button
                  onClick={() => startEdit(companion)}
                  className="p-1 rounded-md hover:bg-secondary transition-colors shrink-0"
                >
                  <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
                </button>

                {/* Delete */}
                <button
                  onClick={() => {
                    const updated = companionShortcuts.filter(
                      (c) => c.id !== companion.id
                    );
                    onCompanionShortcutsChange(updated);
                  }}
                  className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
