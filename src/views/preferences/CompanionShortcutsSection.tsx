import type { CompanionShortcut } from "@/App";
import { Keyboard, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompanionShortcutsSectionProps {
  companionShortcuts: CompanionShortcut[];
  onCompanionShortcutsChange: (shortcuts: CompanionShortcut[]) => void;
}

export default function CompanionShortcutsSection({
  companionShortcuts,
  onCompanionShortcutsChange,
}: CompanionShortcutsSectionProps) {
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
        Envoyer des raccourcis clavier a d'autres applications au demarrage ou a l'arret de l'enregistrement (ex: muter Discord, Teams).
      </p>

      {companionShortcuts.length === 0 ? (
        <div className="p-4 rounded-lg border border-dashed border-border-subtle text-center">
          <p className="text-sm text-muted-foreground">
            Aucun raccourci compagnon configure.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {companionShortcuts.map((companion) => (
            <div
              key={companion.id}
              className="p-4 rounded-lg border border-border-card bg-surface-inset space-y-3"
            >
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={companion.label}
                  onChange={(e) => {
                    const updated = companionShortcuts.map((c) =>
                      c.id === companion.id ? { ...c, label: e.target.value } : c
                    );
                    onCompanionShortcutsChange(updated);
                  }}
                  placeholder="Ex: Mute Discord"
                  className="flex-1 px-3 py-1.5 rounded-lg bg-surface-deep border border-border-card text-sm text-foreground input-glow placeholder:text-muted/50"
                />
                <input
                  type="text"
                  value={companion.keys}
                  onChange={(e) => {
                    const updated = companionShortcuts.map((c) =>
                      c.id === companion.id ? { ...c, keys: e.target.value } : c
                    );
                    onCompanionShortcutsChange(updated);
                  }}
                  placeholder="Ctrl+Shift+M"
                  className="w-40 px-3 py-1.5 rounded-lg bg-surface-deep border border-border-card text-sm font-mono text-foreground input-glow placeholder:text-muted/50"
                />
                <button
                  onClick={() => {
                    const updated = companionShortcuts.filter((c) => c.id !== companion.id);
                    onCompanionShortcutsChange(updated);
                  }}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
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
                    {trigger === "start" ? "Demarrage" : trigger === "stop" ? "Arret" : "Les deux"}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
