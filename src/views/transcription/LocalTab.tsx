import { useState } from "react";
import { HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";
import { GpuSelector } from "@/components/GpuSelector";
import { ModelCard } from "@/components/ModelCard";
import type { ModelInfo, DownloadProgress, GpuInfo, GpuVendor } from "@/App";

type ModelFamily = "standard" | "quantized";

interface LocalTabProps {
  models: ModelInfo[];
  downloadedModels: string[];
  currentModel: string | null;
  isDownloading: boolean;
  downloadProgress: DownloadProgress | null;
  isLoading: boolean;
  gpus: GpuInfo[];
  currentGpuVendor: GpuVendor;
  onDownload: (modelId: string) => void;
  onLoad: (modelId: string) => void;
  onDelete: (modelId: string) => Promise<void>;
  onGpuVendorChange: (vendor: GpuVendor) => void;
}

export function LocalTab({
  models,
  downloadedModels,
  currentModel,
  isDownloading,
  downloadProgress,
  isLoading,
  gpus,
  currentGpuVendor,
  onDownload,
  onLoad,
  onDelete,
  onGpuVendorChange,
}: LocalTabProps) {
  const [modelFamily, setModelFamily] = useState<ModelFamily>("quantized");

  const filteredModels = models.filter((m) => {
    const isQuantized = m.id.includes("-q5") || m.id.includes("-q5_0") || m.id.includes("-q5_1");
    return modelFamily === "quantized" ? isQuantized : !isQuantized;
  });

  return (
    <div className="space-y-5">
      {/* GPU Selection */}
      <GpuSelector
        gpus={gpus}
        currentVendor={currentGpuVendor}
        isLoading={isLoading}
        onVendorChange={onGpuVendorChange}
      />

      {/* Models Selection */}
      <div className="p-5 rounded-xl border border-border-card bg-surface-raised">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-[var(--color-active)]/15 flex items-center justify-center">
              <HardDrive className="h-4 w-4 text-[var(--color-active)]" />
            </div>
            <div>
              <h3 className="font-medium text-sm">Modeles Whisper</h3>
              <p className="text-xs text-muted-foreground">{downloadedModels.length} telecharge(s)</p>
            </div>
          </div>

          {/* Toggle Quantifie/Standard */}
          <div className="flex gap-1 p-0.5 bg-surface-inset rounded-md border border-border-subtle">
            <button
              onClick={() => setModelFamily("quantized")}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-medium transition-all",
                modelFamily === "quantized"
                  ? "bg-surface-active text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Quantifies
            </button>
            <button
              onClick={() => setModelFamily("standard")}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-medium transition-all",
                modelFamily === "standard"
                  ? "bg-surface-active text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Standard
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {filteredModels.map((model) => (
            <ModelCard
              key={model.id}
              model={model}
              isDownloaded={downloadedModels.includes(model.id)}
              isLoaded={currentModel === model.id}
              isDownloading={isDownloading}
              downloadProgress={downloadProgress}
              isLoading={isLoading}
              onDownload={() => onDownload(model.id)}
              onLoad={() => onLoad(model.id)}
              onDelete={() => onDelete(model.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
