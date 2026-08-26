import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Mic, RefreshCw } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function InputDeviceSection() {
  const [devices, setDevices] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [defaultName, setDefaultName] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    invoke<string[]>("list_input_devices").then(setDevices);
    invoke<string | null>("get_input_device").then(setSelected);
    invoke<string>("get_default_input_device").then(setDefaultName).catch(() => {});

    return () => {
      if (refreshTimeout.current) {
        clearTimeout(refreshTimeout.current);
      }
    };
  }, []);

  const handleChange = async (value: string) => {
    const deviceName = value === "__default__" ? null : value;
    setSelected(deviceName);
    await invoke("set_input_device", { deviceName });
  };

  return (
    <div className="p-5 rounded-xl border border-border-card bg-surface-raised space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
          <Mic className="h-4 w-4" />
          Microphone
        </div>
        <span className="text-[11px] text-muted-foreground/60 font-mono">
          {devices.length} device{devices.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-[var(--color-active)]/10 border border-[var(--color-active)]/20 flex items-center justify-center shrink-0">
          <Mic className="h-4 w-4 text-[var(--color-active)]" />
        </div>
        <Select
          value={selected ?? "__default__"}
          onValueChange={handleChange}
        >
          <SelectTrigger className="w-full bg-surface-inset border-border-card">
            <SelectValue placeholder="System default" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__default__">
              System default{defaultName ? ` (${defaultName})` : ""}
            </SelectItem>
            {devices.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          onClick={() => {
            setIsRefreshing(true);
            clearTimeout(refreshTimeout.current);
            invoke<string[]>("list_input_devices").then((list) => {
              setDevices(list);
              refreshTimeout.current = setTimeout(() => setIsRefreshing(false), 600);
            });
          }}
          disabled={isRefreshing}
          className="cursor-pointer h-9 w-9 shrink-0 rounded-lg border border-border-card bg-surface-inset flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-active transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Look for devices again"
        >
          <RefreshCw className={`h-3.5 w-3.5 transition-transform ${isRefreshing ? "animate-spin" : ""}`} />
        </button>
      </div>
    </div>
  );
}
