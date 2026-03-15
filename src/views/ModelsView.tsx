import { ModelInfo, DownloadProgress, GpuInfo, GpuVendor } from "@/App";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Check, Loader2, X, HardDrive, Cpu, Zap, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModelsViewProps {
  models: ModelInfo[];
  downloadedModels: string[];
  currentModel: string | null;
  isDownloading: boolean;
  downloadProgress: DownloadProgress | null;
  isLoading: boolean;
  onDownload: (modelId: string) => void;
  onLoad: (modelId: string) => void;
  onUnload: () => void;
  gpus: GpuInfo[];
  currentGpuVendor: GpuVendor;
  onGpuVendorChange: (vendor: GpuVendor) => void;
}

export default function ModelsView({
  models,
  downloadedModels,
  currentModel,
  isDownloading,
  downloadProgress,
  isLoading,
  onDownload,
  onLoad,
  onUnload,
  gpus,
  currentGpuVendor,
  onGpuVendorChange,
}: ModelsViewProps) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-[oklch(0.22_0.015_260)] flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Modeles Whisper</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Selectionnez et configurez le modele de transcription
          </p>
        </div>
        {currentModel && (
          <Button
            variant="outline"
            size="sm"
            onClick={onUnload}
            className="border-[oklch(0.28_0.015_260)] hover:bg-[oklch(0.20_0.015_260)]"
          >
            <X className="h-4 w-4 mr-2" />
            Decharger
          </Button>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* GPU Selection */}
            <div className="p-5 rounded-xl border border-[oklch(0.25_0.015_260)] bg-[oklch(0.15_0.01_260)] space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                <Zap className="h-4 w-4" />
                Acceleration GPU
              </div>

              <div className="space-y-2">
                {gpus.map((gpu) => (
                  <button
                    key={gpu.vendor}
                    onClick={() => gpu.available && !isLoading && onGpuVendorChange(gpu.vendor)}
                    disabled={!gpu.available || isLoading}
                    className={cn(
                      "w-full p-4 rounded-xl border text-left transition-all duration-200",
                      currentGpuVendor === gpu.vendor
                        ? "border-[var(--color-warning)] bg-[var(--color-warning)]/10"
                        : gpu.available && !isLoading
                        ? "border-[oklch(0.25_0.015_260)] bg-[oklch(0.12_0.01_260)] card-interactive"
                        : "opacity-50 cursor-not-allowed border-[oklch(0.22_0.015_260)] bg-[oklch(0.10_0.01_260)]"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-10 w-10 rounded-lg flex items-center justify-center",
                          currentGpuVendor === gpu.vendor
                            ? "bg-[var(--color-warning)]/20 text-[var(--color-warning)]"
                            : "bg-[oklch(0.20_0.015_260)] text-muted-foreground"
                        )}>
                          {gpu.vendor === "cpu" ? <Cpu className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
                        </div>
                        <div>
                          <div className="font-medium">{gpu.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {isLoading && currentGpuVendor === gpu.vendor ? "Rechargement..." : gpu.description}
                          </div>
                        </div>
                      </div>
                      {currentGpuVendor === gpu.vendor && (
                        isLoading
                          ? <Loader2 className="h-5 w-5 text-[var(--color-warning)] animate-spin" />
                          : <Check className="h-5 w-5 text-[var(--color-warning)]" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Models */}
            <div className="p-5 rounded-xl border border-[oklch(0.25_0.015_260)] bg-[oklch(0.15_0.01_260)] space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                <HardDrive className="h-4 w-4" />
                Modeles disponibles
              </div>

              <div className="space-y-3">
                {models.map((model) => {
                  const isDownloaded = downloadedModels.includes(model.id);
                  const isLoaded = currentModel === model.id;
                  const isCurrentlyDownloading = isDownloading && downloadProgress?.model_id === model.id;

                  return (
                    <div
                      key={model.id}
                      className={cn(
                        "p-4 rounded-xl border transition-all duration-200",
                        isLoaded
                          ? "border-[var(--color-active)] bg-[var(--color-active)]/10"
                          : "border-[oklch(0.25_0.015_260)] bg-[oklch(0.12_0.01_260)]"
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium">{model.name}</h3>
                            {isLoaded && (
                              <span className="badge-active text-[10px] px-2 py-0.5 rounded-md">
                                Actif
                              </span>
                            )}
                            {isDownloaded && !isLoaded && (
                              <Check className="h-4 w-4 text-[var(--color-success)] shrink-0" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {model.description}
                          </p>
                          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                            <HardDrive className="h-3 w-3" />
                            <span>{model.size_mb} MB</span>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {!isDownloaded ? (
                            <Button
                              size="sm"
                              onClick={() => onDownload(model.id)}
                              disabled={isDownloading}
                              className="bg-[var(--color-active)] text-[oklch(0.13_0.01_260)] hover:bg-[var(--color-active)]/90"
                            >
                              {isCurrentlyDownloading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Download className="h-4 w-4 mr-1" />
                                  Telecharger
                                </>
                              )}
                            </Button>
                          ) : isLoaded ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled
                              className="bg-[var(--color-active)]/20 text-[var(--color-active)]"
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Charge
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => onLoad(model.id)}
                              disabled={isLoading}
                              className="border-[oklch(0.28_0.015_260)] hover:bg-[oklch(0.20_0.015_260)]"
                              variant="outline"
                            >
                              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Charger"}
                            </Button>
                          )}
                        </div>
                      </div>

                      {isCurrentlyDownloading && downloadProgress && (
                        <div className="mt-4 pt-4 border-t border-[oklch(0.22_0.015_260)] space-y-2">
                          <Progress value={downloadProgress.progress} className="h-2" />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Telechargement...</span>
                            <span>{downloadProgress.downloaded_mb} / {downloadProgress.total_mb} MB</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Info box */}
            <div className="p-4 rounded-xl bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/20">
              <div className="flex items-start gap-3">
                <Info className="h-4 w-4 text-[var(--color-warning)] mt-0.5 shrink-0" />
                <p className="text-xs text-[var(--color-warning)]/80">
                  L'acceleration GPU ameliore significativement la vitesse de transcription.
                  Le modele sera recharge automatiquement lors du changement de backend.
                </p>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
