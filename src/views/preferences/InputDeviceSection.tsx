import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Mic } from "lucide-react";

export default function InputDeviceSection() {
  const [devices, setDevices] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    invoke<string[]>("list_input_devices").then(setDevices);
    invoke<string | null>("get_input_device").then(setSelected);
  }, []);

  const handleChange = async (value: string) => {
    const deviceName = value === "__default__" ? null : value;
    setSelected(deviceName);
    await invoke("set_input_device", { deviceName });
  };

  return (
    <>
      <div className="p-5 rounded-xl border border-border-card bg-surface-raised space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
          <Mic className="h-4 w-4" />
          Microphone
        </div>

        <div className="space-y-2">
          <label className="font-medium">Peripherique d'entree</label>
          <select
            value={selected ?? "__default__"}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="__default__">Defaut systeme</option>
            {devices.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Micro utilise pour la capture audio STT
          </p>
        </div>
      </div>
    </>
  );
}
