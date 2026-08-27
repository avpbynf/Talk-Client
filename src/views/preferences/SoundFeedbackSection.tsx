import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Volume2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface SoundFeedbackSectionProps {
  soundFeedback: boolean;
  onSoundFeedbackChange: (enabled: boolean) => void;
  startSound: string;
  onStartSoundChange: (preset: string) => void;
  stopSound: string;
  onStopSoundChange: (preset: string) => void;
}

const SYSTEM_DEFAULT = "__default__";

export default function SoundFeedbackSection({
  soundFeedback,
  onSoundFeedbackChange,
  startSound,
  onStartSoundChange,
  stopSound,
  onStopSoundChange,
}: SoundFeedbackSectionProps) {
  const [outputDevices, setOutputDevices] = useState<string[]>([]);
  const [outputDevice, setOutputDevice] = useState<string | null>(null);
  const [defaultOutput, setDefaultOutput] = useState<string | null>(null);

  const readDevices = () => {
    invoke<string[]>("list_output_devices").then(setOutputDevices).catch(() => {});
    invoke<string | null>("get_default_output_device").then(setDefaultOutput).catch(() => {});
  };

  useEffect(() => {
    readDevices();
    invoke<string | null>("get_output_device").then(setOutputDevice).catch(() => {});
  }, []);

  const handleOutputChange = async (value: string) => {
    const deviceName = value === SYSTEM_DEFAULT ? null : value;
    setOutputDevice(deviceName);
    await invoke("set_output_device", { deviceName });
  };

  return (
    <div className="p-5 rounded-xl border border-border-card bg-surface-raised space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
          <Volume2 className="h-4 w-4" />
          Feedback sounds
        </div>
        <Switch checked={soundFeedback} onCheckedChange={onSoundFeedbackChange} />
      </div>

      <p className="text-sm text-muted-foreground">
        Play a sound when recording starts and when it stops.
      </p>

      {soundFeedback && (
        <div className="pt-2 border-t border-border-subtle space-y-4 slide-enter">
          <div className="grid grid-cols-2 gap-4">
            {/* Start sound */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">When it starts</label>
              <Select
                value={startSound}
                onValueChange={(value) => {
                  onStartSoundChange(value);
                  if (value !== "none") invoke("preview_sound", { soundType: "start", preset: value });
                }}
              >
                <SelectTrigger className="cursor-pointer bg-surface-deep border-border-card text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="beep">Beep</SelectItem>
                  <SelectItem value="click">Click</SelectItem>
                  <SelectItem value="chime">Chime</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Stop sound */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">When it stops</label>
              <Select
                value={stopSound}
                onValueChange={(value) => {
                  onStopSoundChange(value);
                  if (value !== "none") invoke("preview_sound", { soundType: "stop", preset: value });
                }}
              >
                <SelectTrigger className="cursor-pointer bg-surface-deep border-border-card text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="beep">Beep</SelectItem>
                  <SelectItem value="click">Click</SelectItem>
                  <SelectItem value="chime">Chime</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Where they play */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Where they play</label>
            <Select
              value={outputDevice ?? SYSTEM_DEFAULT}
              onValueChange={handleOutputChange}
              onOpenChange={(open) => {
                // A headset plugged in while this page is open would otherwise be
                // missing from a list read once at mount.
                if (open) readDevices();
              }}
            >
              <SelectTrigger className="cursor-pointer bg-surface-deep border-border-card text-foreground">
                <SelectValue placeholder="System default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SYSTEM_DEFAULT}>
                  System default{defaultOutput ? ` (${defaultOutput})` : ""}
                </SelectItem>
                {outputDevices.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
