import { Check, Cpu, Zap, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GpuInfo, GpuVendor } from "@/App";

interface GpuSelectorProps {
  gpus: GpuInfo[];
  currentVendor: GpuVendor;
  isLoading: boolean;
  onVendorChange: (vendor: GpuVendor) => void;
}

const GPU_TOOLTIPS: Record<GpuVendor, string> = {
  vulkan: "Compatible AMD, NVIDIA et Intel. API graphique universelle multi-plateforme.",
  cpu: "Fonctionne partout, sans carte graphique. Plus lent mais universel.",
};

const ALL_GPU_OPTIONS: GpuInfo[] = [
  { vendor: "cpu", name: "CPU", available: true, description: "Sans acceleration" },
  { vendor: "vulkan", name: "Vulkan", available: true, description: "GPU generique" },
];

export function GpuSelector({ gpus, currentVendor, isLoading, onVendorChange }: GpuSelectorProps) {
  const mergedGpus = ALL_GPU_OPTIONS.map((defaultGpu) => {
    const backendGpu = gpus.find((g) => g.vendor === defaultGpu.vendor);
    return backendGpu || defaultGpu;
  });

  return (
    <div className="p-5 rounded-xl border border-border-card bg-surface-raised">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-lg bg-[var(--color-warning)]/15 flex items-center justify-center">
          <Zap className="h-4 w-4 text-warning" />
        </div>
        <div>
          <h3 className="font-medium text-sm">Acceleration</h3>
          <p className="text-xs text-muted-foreground">Backend de calcul</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {mergedGpus.map((gpu) => (
          <div key={gpu.vendor} className="relative group">
            <button
              onClick={() => gpu.available && !isLoading && onVendorChange(gpu.vendor)}
              disabled={!gpu.available || isLoading}
              className={cn(
                "w-full p-3 rounded-lg border text-left transition-all duration-200",
                currentVendor === gpu.vendor
                  ? "border-[var(--color-warning)] bg-[var(--color-warning)]/10"
                  : gpu.available && !isLoading
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
                <p className="text-[10px] text-muted-foreground mt-1">Non disponible sur cette machine</p>
              )}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[var(--color-border-hover)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
