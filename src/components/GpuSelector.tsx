import { Check, Cpu, Zap, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GpuDevice, GpuInfo, GpuVendor } from "@/App";

interface GpuSelectorProps {
  gpus: GpuInfo[];
  currentVendor: GpuVendor;
  isLoading: boolean;
  onVendorChange: (vendor: GpuVendor) => void;
  devices: GpuDevice[];
  currentDevice: number;
  /** The card a switch is running towards, or null while nothing is switching. */
  switchingDevice: number | null;
  onDeviceChange: (index: number) => void;
}

const GPU_TOOLTIPS: Record<GpuVendor, string> = {
  vulkan: "Works with AMD, NVIDIA and Intel. One graphics API across every platform.",
  cpu: "Runs anywhere, no graphics card needed. Slower, but it always works.",
};

const ALL_GPU_OPTIONS: GpuInfo[] = [
  { vendor: "cpu", name: "CPU", available: true, description: "No acceleration" },
  { vendor: "vulkan", name: "Vulkan", available: true, description: "Any GPU, through Vulkan" },
];

// An integrated chip reports the shared system memory as its own, so the figure would
// read as if it were the roomier card. Say what it is instead.
function describeDevice(device: GpuDevice) {
  if (device.integrated) {
    return "Integrated";
  }
  if (device.vram_mb >= 1024) {
    return `${Math.round(device.vram_mb / 1024)} GB`;
  }
  return `${device.vram_mb} MB`;
}

export function GpuSelector({
  gpus,
  currentVendor,
  isLoading,
  onVendorChange,
  devices,
  currentDevice,
  switchingDevice,
  onDeviceChange,
}: GpuSelectorProps) {
  const mergedGpus = ALL_GPU_OPTIONS.map((defaultGpu) => {
    const backendGpu = gpus.find((g) => g.vendor === defaultGpu.vendor);
    return backendGpu || defaultGpu;
  });

  const showDevices = currentVendor === "vulkan" && devices.length > 0;

  // Changing card reloads the model, which is a reason to refuse a change of
  // backend at the same time, and no reason at all to make the backend look
  // like it is being decided again. So both tiles go quiet, and the spinner
  // stays on the card that is actually being switched to.
  const switching = switchingDevice !== null;
  const busy = isLoading || switching;

  return (
    <div className="p-5 rounded-xl border border-border-card bg-surface-raised">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-lg bg-[var(--color-warning)]/10 flex items-center justify-center">
          <Zap className="h-4 w-4 text-warning" />
        </div>
        <div>
          <h3 className="font-medium text-sm">Acceleration</h3>
          <p className="text-xs text-muted-foreground">Compute backend</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {mergedGpus.map((gpu) => (
          <div key={gpu.vendor} className="relative group">
            <button
              onClick={() => gpu.available && !busy && onVendorChange(gpu.vendor)}
              disabled={!gpu.available || busy}
              className={cn(
                "w-full p-3 rounded-lg border text-left transition-all duration-200",
                currentVendor === gpu.vendor
                  ? "border-[var(--color-warning)] bg-[var(--color-warning)]/10"
                  : gpu.available && !busy
                  ? "border-border-card bg-surface-inset hover:bg-card"
                  : "opacity-40 cursor-not-allowed border-border-subtle bg-surface-deep"
              )}
            >
              <div className="flex items-center gap-2">
                <div className={cn(
                  "h-7 w-7 rounded-md flex items-center justify-center",
                  currentVendor === gpu.vendor
                    ? "bg-[var(--color-warning)]/20 text-warning"
                    : "bg-surface-active text-muted-foreground"
                )}>
                  {gpu.vendor === "cpu" ? <Cpu className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{gpu.name}</div>
                </div>
                {currentVendor === gpu.vendor && (
                  isLoading
                    ? <Loader2 className="h-4 w-4 text-warning animate-spin shrink-0" />
                    : <Check className="h-4 w-4 text-warning shrink-0" />
                )}
              </div>
            </button>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover border border-border-hover rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-150 pointer-events-none z-50 w-56 text-center">
              <p className="text-xs text-popover-foreground">{GPU_TOOLTIPS[gpu.vendor]}</p>
              {!gpu.available && (
                <p className="text-[10px] text-muted-foreground mt-1">Not available on this machine</p>
              )}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[var(--color-border-hover)]" />
            </div>
          </div>
        ))}
      </div>

      {/* Which card, on a machine carrying more than one */}
      {showDevices && (
        <div className="mt-4 pt-4 border-t border-border-subtle">
          {devices.length > 1 ? (
            <>
              <p className="text-xs text-muted-foreground mb-2">Graphics card</p>
              <div className="space-y-1.5">
                {devices.map((device) => (
                  <button
                    key={device.index}
                    onClick={() =>
                      !busy && device.index !== currentDevice && onDeviceChange(device.index)
                    }
                    disabled={busy}
                    className={cn(
                      "w-full px-3 py-2 rounded-lg border text-left transition-all duration-200",
                      "flex items-center gap-2",
                      device.index === currentDevice
                        ? "border-[var(--color-warning)] bg-[var(--color-warning)]/10"
                        : busy
                        ? "opacity-40 cursor-not-allowed border-border-subtle bg-surface-deep"
                        : "border-border-card bg-surface-inset hover:bg-card"
                    )}
                  >
                    <span className="flex-1 min-w-0 text-sm truncate">{device.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {describeDevice(device)}
                    </span>
                    {device.index === currentDevice && (
                      switchingDevice === device.index
                        ? <Loader2 className="h-4 w-4 text-warning animate-spin shrink-0" />
                        : <Check className="h-4 w-4 text-warning shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Running on {devices[0].name} ({describeDevice(devices[0])})
            </p>
          )}
        </div>
      )}
    </div>
  );
}
