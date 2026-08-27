import { Switch } from "@/components/ui/switch";
import { Monitor } from "lucide-react";

interface SystemSectionProps {
  autostartEnabled: boolean;
  onAutostartChange: (enabled: boolean) => void;
  startMinimized: boolean;
  onStartMinimizedChange: (enabled: boolean) => void;
  duckAudioOnRecord: boolean;
  onDuckAudioOnRecordChange: (enabled: boolean) => void;
  duckVolumePercent: number;
  onDuckVolumePercentChange: (percent: number) => void;
  preserveClipboard: boolean;
  onPreserveClipboardChange: (enabled: boolean) => void;
}

export default function SystemSection({
  autostartEnabled,
  onAutostartChange,
  startMinimized,
  onStartMinimizedChange,
  duckAudioOnRecord,
  onDuckAudioOnRecordChange,
  duckVolumePercent,
  onDuckVolumePercentChange,
  preserveClipboard,
  onPreserveClipboardChange,
}: SystemSectionProps) {
  return (
    <>
      {/* System card */}
      <div className="p-5 rounded-xl border border-border-card bg-surface-raised space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
          <Monitor className="h-4 w-4" />
          System
        </div>

        {/* Autostart */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium">Start with Windows</label>
            <p className="text-sm text-muted-foreground mt-0.5">
              Launch when the session opens
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
            <label className="text-sm font-medium">Start minimised</label>
            <p className="text-sm text-muted-foreground mt-0.5">
              Open straight into the tray
            </p>
          </div>
          <Switch
            checked={startMinimized}
            onCheckedChange={onStartMinimizedChange}
          />
        </div>

        {/* Duck the machine while recording */}
        <div className="border-t border-border-subtle pt-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Turn the volume down</label>
              <p className="text-sm text-muted-foreground mt-0.5">
                Everything the machine plays drops to a share of where it was while you
                talk, and comes back after
              </p>
            </div>
            <Switch
              checked={duckAudioOnRecord}
              onCheckedChange={onDuckAudioOnRecordChange}
            />
          </div>

          {duckAudioOnRecord && (
            <div className="slide-enter mt-4 flex items-center gap-3">
              <label
                htmlFor="duck-volume"
                className="text-xs text-muted-foreground whitespace-nowrap"
              >
                Down to
              </label>
              <input
                id="duck-volume"
                type="range"
                min={0}
                max={90}
                step={5}
                value={duckVolumePercent}
                onChange={(e) => onDuckVolumePercentChange(Number(e.target.value))}
                aria-label="How much of the volume to keep while recording"
                className="flex-1 h-1.5 cursor-pointer appearance-none rounded-full bg-surface-active accent-[var(--color-active)]"
              />
              <span className="w-16 text-right text-xs font-mono text-muted-foreground">
                {duckVolumePercent}% of it
              </span>
            </div>
          )}
        </div>

        {/* Preserve Clipboard */}
        <div className="flex items-center justify-between border-t border-border-subtle pt-4">
          <div>
            <label className="text-sm font-medium">Preserve the clipboard</label>
            <p className="text-sm text-muted-foreground mt-0.5">
              Puts back whatever was in it after pasting
            </p>
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
