import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { CompanionShortcut } from "@/App";
import { Keyboard, Plus, Trash2, Edit3, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompanionShortcutsSectionProps {
  companionShortcuts: CompanionShortcut[];
  onCompanionShortcutsChange: (shortcuts: CompanionShortcut[]) => void;
}

export default function CompanionShortcutsSection({
  companionShortcuts,
  onCompanionShortcutsChange,
}: CompanionShortcutsSectionProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingKeys, setPendingKeys] = useState<string[]>([]);
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

    setPendingKeys(keys);
  };

  const startCapture = async (id: string) => {
    await invoke("disable_shortcuts");
    setEditingId(id);
    setPendingKeys([]);
  };

  const cancelCapture = async () => {
    setEditingId(null);
    setPendingKeys([]);
    await invoke("enable_shortcuts");
  };

  const saveCapture = async () => {
    if (pendingKeys.length < 2 || !editingId) return;

    const hasModifier = pendingKeys.some((k) =>
      ["Ctrl", "Shift", "Alt", "Win"].includes(k)
    );
    const hasKey = pendingKeys.some(
      (k) => !["Ctrl", "Shift", "Alt", "Win"].includes(k)
    );
    if (!hasModifier || !hasKey) return;

    const newKeys = pendingKeys.join("+");
    const updated = companionShortcuts.map((c) =>
      c.id === editingId ? { ...c, keys: newKeys } : c
    );
    onCompanionShortcutsChange(updated);
    setEditingId(null);
    setPendingKeys([]);
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
        <div className="space-y-3">
          {companionShortcuts.map((companion) => {
            const isCapturing = editingId === companion.id;
            const keyParts = companion.keys
              ? companion.keys.split("+")
              : [];

            return (
              <div
                key={companion.id}
                className="p-4 rounded-lg border border-border-card bg-surface-inset space-y-3"
              >
                {/* Label + delete */}
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={companion.label}
                    onChange={(e) => {
                      const updated = companionShortcuts.map((c) =>
                        c.id === companion.id
                          ? { ...c, label: e.target.value }
                          : c
                      );
                      onCompanionShortcutsChange(updated);
                    }}
                    placeholder="Ex: Mute Discord"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-surface-deep border border-border-card text-sm text-foreground input-glow placeholder:text-muted/50"
                  />
                  <button
                    onClick={() => {
                      const updated = companionShortcuts.filter(
                        (c) => c.id !== companion.id
                      );
                      onCompanionShortcutsChange(updated);
                    }}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Key capture */}
                {isCapturing ? (
                  <div className="space-y-2">
                    <div
                      ref={captureRef}
                      tabIndex={0}
                      onKeyDown={handleKeyDown}
                      className="flex gap-2 items-center min-h-[40px] p-2.5 rounded-lg border-2 border-[var(--color-active)] bg-surface-deep focus:outline-none focus:ring-2 focus:ring-[var(--color-active)]/30"
                    >
                      {pendingKeys.length > 0 ? (
                        pendingKeys.map((key, i) => (
                          <kbd key={i}>{key}</kbd>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Appuyez sur les touches...
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={saveCapture}
                        disabled={pendingKeys.length < 2}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-active)] text-background hover:bg-[var(--color-active)]/90 disabled:opacity-50 transition-colors"
                      >
                        <Check className="h-3.5 w-3.5" />
                        OK
                      </button>
                      <button
                        onClick={cancelCapture}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-surface-active transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {keyParts.length > 0 ? (
                      <div className="flex gap-1.5 flex-wrap flex-1">
                        {keyParts.map((key, i) => (
                          <kbd key={i}>{key}</kbd>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground flex-1">
                        Aucun raccourci
                      </span>
                    )}
                    <button
                      onClick={() => startCapture(companion.id)}
                      className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                    >
                      <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                )}

                {/* Trigger selector */}
                <div className="flex gap-2">
                  {(["start", "stop", "both"] as const).map((trigger) => (
                    <button
                      key={trigger}
                      onClick={() => {
                        const updated = companionShortcuts.map((c) =>
                          c.id === companion.id ? { ...c, trigger } : c
                        );
                        onCompanionShortcutsChange(updated);
                      }}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                        companion.trigger === trigger
                          ? "bg-[var(--color-active)]/15 text-[var(--color-active)] border border-[var(--color-active)]/30"
                          : "border border-border-card text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {trigger === "start"
                        ? "Demarrage"
                        : trigger === "stop"
                          ? "Arret"
                          : "Les deux"}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
