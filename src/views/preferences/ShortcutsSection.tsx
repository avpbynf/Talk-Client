import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RecordingMode } from "@/App";
import { Keyboard, Edit3, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShortcutsSectionProps {
  shortcut: string;
  onShortcutChange: (shortcut: string) => Promise<void>;
  cancelShortcut: string;
  onCancelShortcutChange: (shortcut: string) => Promise<void>;
  recordingMode: RecordingMode;
}

export default function ShortcutsSection({
  shortcut,
  onShortcutChange,
  cancelShortcut,
  onCancelShortcutChange,
  recordingMode,
}: ShortcutsSectionProps) {
  const [editingShortcut, setEditingShortcut] = useState<"main" | "cancel" | null>(null);
  const [pendingShortcut, setPendingShortcut] = useState<string[]>([]);
  const [shortcutError, setShortcutError] = useState<string | null>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingShortcut && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingShortcut]);

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
        "Enter": "Enter",
        "Tab": "Tab",
        "Escape": "Escape",
        "Backspace": "Backspace",
        "Delete": "Delete",
        "ArrowUp": "Up",
        "ArrowDown": "Down",
        "ArrowLeft": "Left",
        "ArrowRight": "Right",
      };

      if (keyMap[key]) {
        keys.push(keyMap[key]);
      } else if (key.startsWith("F") && key.length <= 3) {
        keys.push(key);
      } else if (key.length === 1) {
        keys.push(key.toUpperCase());
      }
    }

    setPendingShortcut(keys);
  };

  const startEdit = async (type: "main" | "cancel") => {
    await invoke("disable_shortcuts");
    setEditingShortcut(type);
    setPendingShortcut([]);
    setShortcutError(null);
  };

  const cancelEdit = async () => {
    setEditingShortcut(null);
    setPendingShortcut([]);
    setShortcutError(null);
    await invoke("enable_shortcuts");
  };

  const saveShortcut = async () => {
    if (pendingShortcut.length < 2) {
      setShortcutError("Utilisez au moins un modificateur + une touche");
      return;
    }

    const hasModifier = pendingShortcut.some((k) => ["Ctrl", "Shift", "Alt", "Win"].includes(k));
    const hasKey = pendingShortcut.some((k) => !["Ctrl", "Shift", "Alt", "Win"].includes(k));

    if (!hasModifier || !hasKey) {
      setShortcutError("Utilisez au moins un modificateur + une touche");
      return;
    }

    try {
      const newShortcut = pendingShortcut.join("+");
      if (editingShortcut === "main") {
        await onShortcutChange(newShortcut);
      } else if (editingShortcut === "cancel") {
        await onCancelShortcutChange(newShortcut);
      }
      setEditingShortcut(null);
      setShortcutError(null);
      setPendingShortcut([]);
      await invoke("enable_shortcuts");
    } catch {
      setShortcutError("That combination is invalid or already taken");
      await invoke("enable_shortcuts");
    }
  };

  const renderShortcutCard = (
    type: "main" | "cancel",
    currentShortcut: string,
    label: string,
    description: string
  ) => {
    const isEditing = editingShortcut === type;
    const shortcutParts = currentShortcut.split("+");

    return (
      <div className="p-5 rounded-xl border border-border-card bg-surface-inset">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex gap-3">
            <div className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
              type === "main" ? "bg-[var(--color-active)]/15" : "bg-[var(--color-destructive)]/15"
            )}>
              {type === "main" ? (
                <Keyboard className="h-5 w-5 text-[var(--color-active)]" />
              ) : (
                <X className="h-5 w-5 text-[var(--color-destructive)]" />
              )}
            </div>
            <div>
              <label className="font-medium">{label}</label>
              <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
            </div>
          </div>
          {!isEditing && (
            <button
              onClick={() => startEdit(type)}
              className="cursor-pointer p-2 rounded-lg hover:bg-secondary transition-colors"
            >
              <Edit3 className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-3">
            <div
              ref={inputRef}
              tabIndex={0}
              onKeyDown={handleKeyDown}
              className={cn(
                "flex gap-2 items-center min-h-[48px] p-3 rounded-lg border-2 bg-surface-inset focus:outline-none focus:ring-2",
                type === "main"
                  ? "border-[var(--color-active)] focus:ring-[var(--color-active)]/30"
                  : "border-[var(--color-destructive)] focus:ring-[var(--color-destructive)]/30"
              )}
            >
              {pendingShortcut.length > 0 ? (
                pendingShortcut.map((key, i) => (
                  <kbd key={i}>{key}</kbd>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">Appuyez sur les touches...</span>
              )}
            </div>

            {shortcutError && <p className="text-xs text-[var(--color-destructive)]">{shortcutError}</p>}

            <div className="flex gap-2">
              <button
                onClick={saveShortcut}
                disabled={pendingShortcut.length === 0}
                className={cn(
                  "cursor-pointer flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 transition-colors",
                  type === "main"
                    ? "bg-[var(--color-active)] text-background hover:bg-[var(--color-active)]/90"
                    : "bg-[var(--color-destructive)] text-white hover:bg-[var(--color-destructive)]/90"
                )}
              >
                <Check className="h-4 w-4" />
                Enregistrer
              </button>
              <button
                onClick={cancelEdit}
                className="cursor-pointer flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-surface-active transition-colors"
              >
                <X className="h-4 w-4" />
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {shortcutParts.map((key, i) => (
              <kbd key={i}>{key}</kbd>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-5 rounded-xl border border-border-card bg-surface-raised space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
        <Keyboard className="h-4 w-4" />
        Raccourcis
      </div>
      <div className="grid grid-cols-2 gap-4">
      {renderShortcutCard(
        "main",
        shortcut,
        "Raccourci principal",
        recordingMode === "toggle" ? "Starts and stops" : "Hold it down to record"
      )}
      {renderShortcutCard(
        "cancel",
        cancelShortcut,
        "Annulation",
        "Annule l'enregistrement"
      )}
      </div>
    </div>
  );
}
