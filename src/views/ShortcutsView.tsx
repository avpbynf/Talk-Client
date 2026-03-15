import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RecordingMode } from "@/App";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Keyboard, Edit3, Check, X } from "lucide-react";

interface ShortcutsViewProps {
  recordingMode: RecordingMode;
  onRecordingModeChange: (mode: RecordingMode) => void;
  shortcut: string;
  onShortcutChange: (shortcut: string) => Promise<void>;
  cancelShortcut: string;
  onCancelShortcutChange: (shortcut: string) => Promise<void>;
}

export default function ShortcutsView({
  recordingMode,
  onRecordingModeChange,
  shortcut,
  onShortcutChange,
  cancelShortcut,
  onCancelShortcutChange,
}: ShortcutsViewProps) {
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
        "Insert": "Insert",
        "Home": "Home",
        "End": "End",
        "PageUp": "PageUp",
        "PageDown": "PageDown",
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

    const hasModifier = pendingShortcut.some((k) =>
      ["Ctrl", "Shift", "Alt", "Win"].includes(k)
    );
    const hasKey = pendingShortcut.some(
      (k) => !["Ctrl", "Shift", "Alt", "Win"].includes(k)
    );

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
    } catch (error) {
      console.error("Failed to update shortcut:", error);
      setShortcutError("Raccourci invalide ou deja utilise");
      await invoke("enable_shortcuts");
    }
  };

  const getColorClass = (type: "main" | "cancel") => {
    switch (type) {
      case "main": return "text-primary";
      case "cancel": return "text-red-500";
    }
  };

  const getBorderClass = (type: "main" | "cancel") => {
    switch (type) {
      case "main": return "border-primary focus:ring-primary/50";
      case "cancel": return "border-red-500 focus:ring-red-500/50";
    }
  };

  const getButtonClass = (type: "main" | "cancel") => {
    switch (type) {
      case "main": return "bg-primary text-primary-foreground hover:bg-primary/90";
      case "cancel": return "bg-red-500 text-white hover:bg-red-600";
    }
  };

  const renderShortcutEditor = (
    type: "main" | "cancel",
    currentShortcut: string,
    label: string,
    description: string,
    icon: React.ReactNode
  ) => {
    const isEditing = editingShortcut === type;
    const shortcutParts = currentShortcut.split("+");

    return (
      <div className="p-5 rounded-xl border border-[oklch(0.25_0.015_260)] bg-[oklch(0.15_0.01_260)] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <label className="font-medium">{label}</label>
          </div>
          {!isEditing && (
            <button
              onClick={() => startEdit(type)}
              className="p-2 rounded-lg hover:bg-[oklch(0.22_0.015_260)] transition-colors"
              title="Modifier le raccourci"
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
              className={`flex gap-2 items-center min-h-[48px] p-3 rounded-lg border-2 bg-[oklch(0.12_0.01_260)] focus:outline-none focus:ring-2 ${getBorderClass(type)}`}
            >
              {pendingShortcut.length > 0 ? (
                pendingShortcut.map((key, i) => (
                  <kbd key={i}>{key}</kbd>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">
                  Appuyez sur les touches...
                </span>
              )}
            </div>

            {shortcutError && (
              <p className="text-xs text-[var(--color-destructive)]">{shortcutError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={saveShortcut}
                disabled={pendingShortcut.length === 0}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${getButtonClass(type)}`}
              >
                <Check className="h-4 w-4" />
                Enregistrer
              </button>
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-[oklch(0.28_0.015_260)] rounded-lg hover:bg-[oklch(0.20_0.015_260)] transition-colors"
              >
                <X className="h-4 w-4" />
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-2 flex-wrap">
              {shortcutParts.map((key, i) => (
                <kbd key={i}>{key}</kbd>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{description}</p>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-[oklch(0.22_0.015_260)] shrink-0">
        <h1 className="text-xl font-semibold tracking-tight">Raccourcis</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configurez les raccourcis clavier
        </p>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Recording Mode */}
            <div className="p-5 rounded-xl border border-[oklch(0.25_0.015_260)] bg-[oklch(0.15_0.01_260)]">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <label className="font-medium">Mode d'enregistrement</label>
                  <p className="text-sm text-muted-foreground">
                    {recordingMode === "toggle"
                      ? "Appuyez pour demarrer/arreter"
                      : "Maintenez pour enregistrer (push-to-talk)"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${recordingMode === "push_to_talk" ? "text-foreground" : "text-muted-foreground"}`}>
                    Maintenir
                  </span>
                  <Switch
                    checked={recordingMode === "toggle"}
                    onCheckedChange={(checked) =>
                      onRecordingModeChange(checked ? "toggle" : "push_to_talk")
                    }
                  />
                  <span className={`text-xs ${recordingMode === "toggle" ? "text-foreground" : "text-muted-foreground"}`}>
                    Toggle
                  </span>
                </div>
              </div>
            </div>

            {/* Shortcuts */}
            <div className="space-y-3">
              {/* Main Shortcut */}
              {renderShortcutEditor(
                "main",
                shortcut,
                "Principal",
                recordingMode === "toggle"
                  ? "Demarre ou arrete l'enregistrement"
                  : "Maintenez pour enregistrer",
                <Keyboard className={`h-4 w-4 ${getColorClass("main")}`} />
              )}

              {/* Cancel Shortcut */}
              {renderShortcutEditor(
                "cancel",
                cancelShortcut,
                "Annulation",
                "Annule l'enregistrement en cours",
                <X className={`h-4 w-4 ${getColorClass("cancel")}`} />
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
