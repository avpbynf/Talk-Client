import { Switch } from "@/components/ui/switch";
import { Monitor } from "lucide-react";

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

        {/* Pause Media */}
        <div className="flex items-center justify-between border-t border-border-subtle pt-4">
          <div>
            <label className="text-sm font-medium">Pause media</label>
            <p className="text-sm text-muted-foreground mt-0.5">
              Pauses whatever is playing while you record
            </p>
          </div>
          <Switch
            checked={pauseMediaOnRecord}
            onCheckedChange={onPauseMediaOnRecordChange}
          />
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
