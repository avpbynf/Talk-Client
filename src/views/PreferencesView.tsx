import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RecordingMode, OverlaySize } from "@/App";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Keyboard, Edit3, Check, X, Maximize2, Info, Layers, Hand, ToggleLeft, Monitor, Music, ClipboardCopy } from "lucide-react";
import { cn } from "@/lib/utils";

interface PreferencesViewProps {
  recordingMode: RecordingMode;
  onRecordingModeChange: (mode: RecordingMode) => void;
  shortcut: string;
  onShortcutChange: (shortcut: string) => Promise<void>;
  cancelShortcut: string;
  onCancelShortcutChange: (shortcut: string) => Promise<void>;
  overlaySize: OverlaySize;
  onOverlaySizeChange: (size: OverlaySize) => void;
  autostartEnabled: boolean;
  onAutostartChange: (enabled: boolean) => void;
  startMinimized: boolean;
  onStartMinimizedChange: (enabled: boolean) => void;
  pauseMediaOnRecord: boolean;
  onPauseMediaOnRecordChange: (enabled: boolean) => void;
  preserveClipboard: boolean;
  onPreserveClipboardChange: (enabled: boolean) => void;
}

const overlaySizes: { id: OverlaySize; name: string; description: string; preview: string }[] = [
  { id: "small", name: "Petit", description: "Compact et discret", preview: "120 x 40" },
  { id: "medium", name: "Moyen", description: "Taille par defaut", preview: "200 x 60" },
  { id: "large", name: "Grand", description: "Plus visible", preview: "280 x 80" },
];

export default function PreferencesView({
  recordingMode,
  onRecordingModeChange,
  shortcut,
  onShortcutChange,
  cancelShortcut,
  onCancelShortcutChange,
  overlaySize,
  onOverlaySizeChange,
  autostartEnabled,
  onAutostartChange,
  startMinimized,
  onStartMinimizedChange,
  pauseMediaOnRecord,
  onPauseMediaOnRecordChange,
  preserveClipboard,
  onPreserveClipboardChange,
}: PreferencesViewProps) {
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
      setShortcutError("Raccourci invalide ou deja utilise");
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
      <div className="p-5 rounded-xl border border-[oklch(0.25_0.015_260)] bg-[oklch(0.15_0.01_260)]">
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
              className="p-2 rounded-lg hover:bg-[oklch(0.22_0.015_260)] transition-colors"
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
                "flex gap-2 items-center min-h-[48px] p-3 rounded-lg border-2 bg-[oklch(0.12_0.01_260)] focus:outline-none focus:ring-2",
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
                  "flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 transition-colors",
                  type === "main"
                    ? "bg-[var(--color-active)] text-[oklch(0.13_0.01_260)] hover:bg-[var(--color-active)]/90"
                    : "bg-[var(--color-destructive)] text-white hover:bg-[var(--color-destructive)]/90"
                )}
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
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-[oklch(0.22_0.015_260)] shrink-0">
        <h1 className="text-xl font-semibold tracking-tight">Preferences</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Raccourcis clavier et apparence de l'overlay
        </p>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Recording Mode */}
            <div className="p-5 rounded-xl border border-[oklch(0.25_0.015_260)] bg-[oklch(0.15_0.01_260)] space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                <Keyboard className="h-4 w-4" />
                Mode d'enregistrement
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => onRecordingModeChange("push_to_talk")}
                  className={cn(
                    "p-4 rounded-xl border text-left transition-all duration-200 flex items-center gap-3",
                    recordingMode === "push_to_talk"
                      ? "border-[var(--color-active)] bg-[var(--color-active)]/10"
                      : "border-[oklch(0.25_0.015_260)] bg-[oklch(0.12_0.01_260)] card-interactive"
                  )}
                >
                  <Hand className={cn(
                    "h-5 w-5",
                    recordingMode === "push_to_talk" ? "text-[var(--color-active)]" : "text-muted-foreground"
                  )} />
                  <div>
                    <div className="font-medium text-sm">Maintenir</div>
                    <div className="text-xs text-muted-foreground">Push-to-talk</div>
                  </div>
                </button>

                <button
                  onClick={() => onRecordingModeChange("toggle")}
                  className={cn(
                    "p-4 rounded-xl border text-left transition-all duration-200 flex items-center gap-3",
                    recordingMode === "toggle"
                      ? "border-[var(--color-active)] bg-[var(--color-active)]/10"
                      : "border-[oklch(0.25_0.015_260)] bg-[oklch(0.12_0.01_260)] card-interactive"
                  )}
                >
                  <ToggleLeft className={cn(
                    "h-5 w-5",
                    recordingMode === "toggle" ? "text-[var(--color-active)]" : "text-muted-foreground"
                  )} />
                  <div>
                    <div className="font-medium text-sm">Toggle</div>
                    <div className="text-xs text-muted-foreground">Clic on/off</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Shortcuts */}
            <div className="space-y-3">
              {renderShortcutCard(
                "main",
                shortcut,
                "Raccourci principal",
                recordingMode === "toggle" ? "Demarre ou arrete" : "Maintenez pour enregistrer"
              )}
              {renderShortcutCard(
                "cancel",
                cancelShortcut,
                "Annulation",
                "Annule l'enregistrement en cours"
              )}
            </div>

            {/* Overlay Section */}
            <div className="p-5 rounded-xl border border-[oklch(0.25_0.015_260)] bg-[oklch(0.15_0.01_260)] space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                <Layers className="h-4 w-4" />
                Overlay
              </div>

              {/* Size Selection */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Taille de l'overlay</label>
                <div className="space-y-2">
                  {overlaySizes.map((size) => (
                    <button
                      key={size.id}
                      onClick={() => onOverlaySizeChange(size.id)}
                      className={cn(
                        "w-full p-4 rounded-xl border text-left transition-all duration-200 flex items-center justify-between",
                        overlaySize === size.id
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-[oklch(0.25_0.015_260)] bg-[oklch(0.12_0.01_260)] card-interactive"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Maximize2 className={cn(
                          "h-5 w-5",
                          overlaySize === size.id ? "text-blue-500" : "text-muted-foreground"
                        )} />
                        <div>
                          <div className="font-medium">{size.name}</div>
                          <div className="text-xs text-muted-foreground">{size.description}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-muted-foreground">{size.preview}</span>
                        {overlaySize === size.id && <Check className="h-5 w-5 text-blue-500" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Position Info */}
              <div className="pt-4 border-t border-[oklch(0.22_0.015_260)]">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <label className="font-medium">Position</label>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Glissez l'overlay pendant l'enregistrement pour changer sa position. Elle sera sauvegardee automatiquement.
                </p>
              </div>
            </div>

            {/* System Section */}
            <div className="p-5 rounded-xl border border-[oklch(0.25_0.015_260)] bg-[oklch(0.15_0.01_260)] space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                <Monitor className="h-4 w-4" />
                Systeme
              </div>

              {/* Autostart */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium">Lancer au demarrage</label>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Demarrer automatiquement avec Windows
                  </p>
                </div>
                <Switch
                  checked={autostartEnabled}
                  onCheckedChange={onAutostartChange}
                />
              </div>

              {/* Start Minimized */}
              <div className="flex items-center justify-between border-t border-[oklch(0.22_0.015_260)] pt-4">
                <div>
                  <label className="font-medium">Demarrer minimise</label>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Ouvrir directement dans la barre systeme
                  </p>
                </div>
                <Switch
                  checked={startMinimized}
                  onCheckedChange={onStartMinimizedChange}
                />
              </div>

              {/* Pause Media */}
              <div className="flex items-center justify-between border-t border-[oklch(0.22_0.015_260)] pt-4">
                <div className="flex gap-3">
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 bg-purple-500/15">
                    <Music className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <label className="font-medium">Pause media</label>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Met en pause la musique pendant l'enregistrement
                    </p>
                  </div>
                </div>
                <Switch
                  checked={pauseMediaOnRecord}
                  onCheckedChange={onPauseMediaOnRecordChange}
                />
              </div>

              {/* Preserve Clipboard */}
              <div className="flex items-center justify-between border-t border-[oklch(0.22_0.015_260)] pt-4">
                <div className="flex gap-3">
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 bg-amber-500/15">
                    <ClipboardCopy className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <label className="font-medium">Preserver le presse-papier</label>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Restaure le contenu du presse-papier apres le collage
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preserveClipboard}
                  onCheckedChange={onPreserveClipboardChange}
                />
              </div>
            </div>

            {/* Info */}
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-start gap-3">
                <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-300/80">
                  Les changements de taille prennent effet au prochain enregistrement.
                </p>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
