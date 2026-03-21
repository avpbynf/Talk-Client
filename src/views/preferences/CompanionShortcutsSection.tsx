import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { CompanionShortcut } from "@/App";
import { Keyboard, Plus, Trash2, Check, X, Edit3, ChevronUp, ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const TRIGGER_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  start: {
    label: "Demarrage",
    color: "text-[var(--color-success)]",
    bg: "bg-[var(--color-success)]/12",
    border: "border-[var(--color-success)]/25",
  },
  stop: {
    label: "Arret",
    color: "text-[var(--color-warning)]",
    bg: "bg-[var(--color-warning)]/12",
    border: "border-[var(--color-warning)]/25",
  },
  both: {
    label: "Les deux",
    color: "text-[var(--color-active)]",
    bg: "bg-[var(--color-active)]/12",
    border: "border-[var(--color-active)]/25",
  },
};

export default function CompanionShortcutsSection({
  companionShortcuts,
  onCompanionShortcutsChange,
}: CompanionShortcutsSectionProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [capturing, setCapturing] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (capturing && captureRef.current) {
      captureRef.current.focus();
    }
  }, [capturing]);

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
    // If this was a new empty shortcut, remove it
    if (editingId) {
      const companion = companionShortcuts.find((c) => c.id === editingId);
      if (companion && !companion.keys && !companion.label) {
        onCompanionShortcutsChange(
          companionShortcuts.filter((c) => c.id !== editingId)
        );
      }
    }
    setEditingId(null);
    setDraft(null);
    setCapturing(false);
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
    setCapturing(false);
    await invoke("enable_shortcuts");
  };

  const moveShortcut = (id: string, direction: -1 | 1) => {
    const index = companionShortcuts.findIndex((c) => c.id === id);
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= companionShortcuts.length) return;
    const reordered = [...companionShortcuts];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, moved);
    onCompanionShortcutsChange(reordered);
  };

  const deleteShortcut = async (id: string) => {
    onCompanionShortcutsChange(
      companionShortcuts.filter((c) => c.id !== id)
    );
    if (editingId === id) {
      setEditingId(null);
      setDraft(null);
      await invoke("enable_shortcuts");
    }
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
        <div className="py-8 rounded-lg border border-dashed border-border-subtle text-center">
          <Keyboard className="h-5 w-5 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Aucun raccourci compagnon
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {companionShortcuts.map((companion, index) => {
            const isEditing = editingId === companion.id;
            const meta = TRIGGER_META[companion.trigger];
            const isFirst = index === 0;
            const isLast = index === companionShortcuts.length - 1;
            const keyParts = companion.keys
              ? companion.keys.split("+")
              : [];

            /* ── Edit mode ─────────────────────────────────── */
            if (isEditing && draft) {
              const draftMeta = TRIGGER_META[draft.trigger];
              const displayKeys =
                draft.pendingKeys.length > 0
                  ? draft.pendingKeys
                  : draft.keys
                    ? draft.keys.split("+")
                    : [];

              return (
                <div
                  key={companion.id}
                  className="rounded-lg border border-[var(--color-active)]/40 bg-surface-inset overflow-hidden"
                >
                  {/* Main edit row: Label → Trigger → Keys */}
                  <div className="flex items-center gap-2 p-3">
                    {/* Label input */}
                    <input
                      type="text"
                      value={draft.label}
                      onChange={(e) =>
                        setDraft({ ...draft, label: e.target.value })
                      }
                      placeholder="Nom du raccourci"
                      className="flex-1 px-2.5 py-1 rounded-md bg-surface-deep border border-border-card text-sm text-foreground input-glow placeholder:text-muted-foreground/30 min-w-0"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") cancelEdit();
                      }}
                    />

                    {/* Trigger dropdown */}
                    <Select
                      value={draft.trigger}
                      onValueChange={(v) =>
                        setDraft({ ...draft, trigger: v as "start" | "stop" | "both" })
                      }
                    >
                      <SelectTrigger className="w-[120px] shrink-0 bg-surface-deep border-border-card text-foreground h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="start">Demarrage</SelectItem>
                        <SelectItem value="stop">Arret</SelectItem>
                        <SelectItem value="both">Les deux</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Key display / capture */}
                    {capturing ? (
                      <div
                        ref={captureRef}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          handleKeyDown(e);
                          setCapturing(false);
                        }}
                        onBlur={() => setCapturing(false)}
                        className="flex gap-1.5 items-center min-h-[32px] px-2.5 py-1 rounded-md border-2 border-[var(--color-active)] bg-surface-deep min-w-[110px] focus:outline-none focus:ring-2 focus:ring-[var(--color-active)]/30"
                      >
                        <span className="text-[11px] text-muted-foreground/50 whitespace-nowrap">
                          Appuyez sur les touches...
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {displayKeys.length > 0 ? (
                          <div className="flex gap-1 items-center px-2.5 py-1 rounded-md border border-border-card bg-surface-deep min-h-[32px]">
                            {displayKeys.map((key, i) => (
                              <kbd key={i} className="text-[11px] px-1.5 py-0.5">
                                {key}
                              </kbd>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground/40 italic px-2.5 py-1 rounded-md border border-dashed border-border-card min-h-[32px] flex items-center">
                            non assigne
                          </span>
                        )}
                        <button
                          onClick={() => setCapturing(true)}
                          className="p-1.5 rounded-md hover:bg-secondary transition-colors"
                          title="Modifier le raccourci"
                        >
                          <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Action bar: [Supprimer] [Up] [Down] ---- [Annuler] [Enregistrer] */}
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-surface-deep/50 border-t border-border-subtle">
                    <button
                      onClick={() => deleteShortcut(companion.id)}
                      className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                      Supprimer
                    </button>
                    <button
                      onClick={() => moveShortcut(companion.id, -1)}
                      disabled={isFirst}
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-active disabled:opacity-20 disabled:pointer-events-none transition-colors"
                      title="Monter"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => moveShortcut(companion.id, 1)}
                      disabled={isLast}
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-active disabled:opacity-20 disabled:pointer-events-none transition-colors"
                      title="Descendre"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={cancelEdit}
                      className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-active transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={saveEdit}
                      className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md bg-[var(--color-active)] text-background hover:bg-[var(--color-active)]/90 transition-colors"
                    >
                      <Check className="h-3 w-3" />
                      Enregistrer
                    </button>
                  </div>
                </div>
              );
            }

            /* ── View mode — clickable row: Label → Trigger → Keys ── */
            return (
              <div
                key={companion.id}
                onClick={() => startEdit(companion)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border-card bg-surface-inset hover:border-border-hover hover:bg-surface-raised cursor-pointer transition-colors"
              >
                {/* Label */}
                <span className="flex-1 text-sm text-foreground/80 truncate min-w-0">
                  {companion.label || (
                    <span className="text-muted-foreground/40 italic">
                      sans nom
                    </span>
                  )}
                </span>

                {/* Trigger badge */}
                <span
                  className={cn(
                    "shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border",
                    meta.color,
                    meta.bg,
                    meta.border
                  )}
                >
                  {meta.label}
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
                  <span className="text-[11px] text-muted-foreground/40 shrink-0 italic">
                    non assigne
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
