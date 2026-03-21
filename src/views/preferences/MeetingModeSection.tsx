import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Switch } from "@/components/ui/switch";
import { Radio } from "lucide-react";

interface VirtualAudioStatus {
  installed: boolean;
  device_name: string | null;
}

export default function MeetingModeSection() {
  const [driverStatus, setDriverStatus] = useState<VirtualAudioStatus>({
    installed: false,
    device_name: null,
  });
  const [meetingMode, setMeetingMode] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    invoke<VirtualAudioStatus>("get_virtual_audio_status").then(setDriverStatus);
    invoke<boolean>("get_meeting_mode").then(setMeetingMode);

    const unlisten = listen<boolean>("meeting-mode-changed", (e) => {
      setMeetingMode(e.payload);
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const handleToggle = async (enabled: boolean) => {
    setLoading(true);
    try {
      await invoke("set_meeting_mode", { enabled });
      setMeetingMode(enabled);
    } catch (err) {
      console.error("Failed to toggle meeting mode:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="p-5 rounded-xl border border-border-card bg-surface-raised space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
          <Radio className="h-4 w-4" />
          Mode reunion
        </div>

        {/* Virtual Audio Driver status indicator */}
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${
              driverStatus.installed ? "bg-emerald-500" : "bg-red-500"
            }`}
          />
          <span className="text-xs text-muted-foreground">
            {driverStatus.installed
              ? `Driver audio virtuel detecte (${driverStatus.device_name})`
              : "Driver audio virtuel non installe"}
          </span>
        </div>

        {/* Meeting mode toggle */}
        <div className="flex items-center justify-between">
          <div>
            <label
              className={`font-medium ${!driverStatus.installed ? "opacity-50" : ""}`}
            >
              Mode reunion
            </label>
            <p className="text-sm text-muted-foreground mt-0.5">
              Route le micro via un device virtuel pour couper le son en reunion
            </p>
          </div>
          <Switch
            checked={meetingMode}
            onCheckedChange={handleToggle}
            disabled={!driverStatus.installed || loading}
          />
        </div>

        {driverStatus.installed && (
          <p className="text-xs text-muted-foreground border-t border-border-subtle pt-3">
            Configurez Teams/Discord pour utiliser &laquo;&nbsp;Virtual Mic
            Driver&nbsp;&raquo; comme micro. Pendant la dictee, les participants
            n'entendront rien.
          </p>
        )}
      </div>
    </>
  );
}
