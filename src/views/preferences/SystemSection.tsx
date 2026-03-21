import { Switch } from "@/components/ui/switch";
import { Monitor, Music, ClipboardCopy } from "lucide-react";

interface SystemSectionProps {
  autostartEnabled: boolean;
  onAutostartChange: (enabled: boolean) => void;
  startMinimized: boolean;
  onStartMinimizedChange: (enabled: boolean) => void;
  pauseMediaOnRecord: boolean;
  onPauseMediaOnRecordChange: (enabled: boolean) => void;
  preserveClipboard: boolean;
  onPreserveClipboardChange: (enabled: boolean) => void;
}

export default function SystemSection({
  autostartEnabled,
  onAutostartChange,
  startMinimized,
  onStartMinimizedChange,
  pauseMediaOnRecord,
  onPauseMediaOnRecordChange,
  preserveClipboard,
  onPreserveClipboardChange,
}: SystemSectionProps) {
  return (
    <>
      {/* System card */}
      <div className="p-5 rounded-xl border border-border-card bg-surface-raised space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
          <Monitor className="h-4 w-4" />
          Système
        </div>

        {/* Autostart */}
        <div className="flex items-center justify-between">
          <div>
            <label className="font-medium">Lancer au démarrage</label>
            <p className="text-sm text-muted-foreground mt-0.5">
              Démarrer automatiquement avec Windows
            </p>
          </div>
          <Switch
            checked={autostartEnabled}
            onCheckedChange={onAutostartChange}
          />
        </div>

        {/* Start Minimized */}
        <div className="flex items-center justify-between border-t border-border-subtle pt-4">
          <div>
            <label className="font-medium">Démarrer minimisé</label>
            <p className="text-sm text-muted-foreground mt-0.5">
              Ouvrir directement dans la barre système
            </p>
          </div>
          <Switch
            checked={startMinimized}
            onCheckedChange={onStartMinimizedChange}
          />
        </div>

        {/* Pause Media */}
        <div className="flex items-center justify-between border-t border-border-subtle pt-4">
          <div className="flex gap-3">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 bg-[var(--color-hybrid)]/15">
              <Music className="h-5 w-5 text-hybrid" />
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
        <div className="flex items-center justify-between border-t border-border-subtle pt-4">
          <div className="flex gap-3">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 bg-[var(--color-warning)]/15">
              <ClipboardCopy className="h-5 w-5 text-warning" />
            </div>
            <div>
              <label className="font-medium">Préserver le presse-papier</label>
              <p className="text-sm text-muted-foreground mt-0.5">
                Restaure le contenu du presse-papier après le collage
              </p>
            </div>
          </div>
          <Switch
            checked={preserveClipboard}
            onCheckedChange={onPreserveClipboardChange}
          />
        </div>
      </div>
    </>
  );
}
