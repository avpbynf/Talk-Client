import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ModelInfo,
  DownloadProgress,
  GpuInfo,
  GpuVendor,
  TranscriptionMode,
} from "@/App";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Download,
  Check,
  Loader2,
  X,
  HardDrive,
  Cpu,
  Zap,
  Server,
  WifiOff,
  AlertCircle,
  RefreshCw,
  Clock,
  ArrowDownToLine,
  Trash2,
  Activity,
  Globe,
  Settings2,
  Shield,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type ServerStatus = "unknown" | "checking" | "online" | "offline";
type ModelFamily = "standard" | "quantized";
type TabId = "engine" | "local" | "server";

// Mode effectif pour l'UI (combine transcriptionMode + serverFallback)
type EngineMode = "local" | "server" | "server_fallback";

interface TranscriptionViewProps {
  // Models
  models: ModelInfo[];
  downloadedModels: string[];
  currentModel: string | null;
  isDownloading: boolean;
  downloadProgress: DownloadProgress | null;
  isLoading: boolean;
  onDownload: (modelId: string) => void;
  onLoad: (modelId: string) => void;
  onUnload: () => void;
  onDelete: (modelId: string) => Promise<void>;
  gpus: GpuInfo[];
  currentGpuVendor: GpuVendor;
  onGpuVendorChange: (vendor: GpuVendor) => void;
  // Server
  transcriptionMode: TranscriptionMode;
  onTranscriptionModeChange: (mode: TranscriptionMode) => void;
  serverUrl: string;
  onServerUrlChange: (url: string) => void;
  serverFallback: boolean;
  onServerFallbackChange: (enabled: boolean) => void;
  serverTimeout: number;
  onServerTimeoutChange: (timeout: number) => void;
}

export default function TranscriptionView({
  models,
  downloadedModels,
  currentModel,
  isDownloading,
  downloadProgress,
  isLoading,
  onDownload,
  onLoad,
  onUnload,
  onDelete,
  gpus,
  currentGpuVendor,
  onGpuVendorChange,
  transcriptionMode,
  onTranscriptionModeChange,
  serverUrl,
  onServerUrlChange,
  serverFallback,
  onServerFallbackChange,
  serverTimeout,
  onServerTimeoutChange,
}: TranscriptionViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>("engine");
  const [serverStatus, setServerStatus] = useState<ServerStatus>("unknown");
  const [urlInput, setUrlInput] = useState(serverUrl);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [modelFamily, setModelFamily] = useState<ModelFamily>("quantized");
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const isCheckingRef = useRef(false);

  // Derive engine mode from props
  const engineMode: EngineMode = transcriptionMode === "local"
    ? "local"
    : serverFallback
      ? "server_fallback"
      : "server";

  // Handle engine mode change
  const handleEngineModeChange = (mode: EngineMode) => {
    switch (mode) {
      case "local":
        onTranscriptionModeChange("local");
        break;
      case "server":
        onTranscriptionModeChange("server");
        onServerFallbackChange(false);
        break;
      case "server_fallback":
        onTranscriptionModeChange("server");
        onServerFallbackChange(true);
        break;
    }
  };

  // Filter models by family
  const filteredModels = models.filter((m) => {
    const isQuantized = m.id.includes("-q5") || m.id.includes("-q5_0") || m.id.includes("-q5_1");
    return modelFamily === "quantized" ? isQuantized : !isQuantized;
  });

  // Server functions
  const checkServerHealth = async (silent = false) => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;
    if (!silent) {
      setServerStatus("checking");
    }
    try {
      const isHealthy = await invoke<boolean>("check_server_health");
      setServerStatus(isHealthy ? "online" : "offline");
    } catch {
      setServerStatus("offline");
    } finally {
      isCheckingRef.current = false;
    }
  };

  const saveServerUrl = () => {
    try {
      new URL(urlInput);
      setUrlError(null);
      onServerUrlChange(urlInput);
      setServerStatus("unknown");
    } catch {
      setUrlError("URL invalide");
    }
  };

  const statusIcon = (size: "sm" | "md" = "md") => {
    const sizeClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
    switch (serverStatus) {
      case "checking":
        return <Loader2 className={cn(sizeClass, "text-blue-400 animate-spin")} />;
      case "online":
        return <Check className={cn(sizeClass, "text-[var(--color-success)]")} />;
      case "offline":
        return <WifiOff className={cn(sizeClass, "text-[var(--color-destructive)]")} />;
      default:
        return <AlertCircle className={cn(sizeClass, "text-muted-foreground")} />;
    }
  };

  const statusText = () => {
    switch (serverStatus) {
      case "checking": return "Verification...";
      case "online": return "Connecte";
      case "offline": return "Indisponible";
      default: return "Non teste";
    }
  };

  const timeoutOptions = [
    { value: 10000, label: "10s" },
    { value: 30000, label: "30s" },
    { value: 60000, label: "1min" },
    { value: 120000, label: "2min" },
  ];

  const isServerMode = transcriptionMode === "server";

  // Polling du statut serveur en mode serveur
  useEffect(() => {
    if (!isServerMode) {
      return;
    }
    checkServerHealth(false);
    const interval = setInterval(() => {
      checkServerHealth(true);
    }, 5000);
    return () => {
      clearInterval(interval);
    };
  }, [isServerMode, serverUrl]);

  // GPU options
  const allGpuOptions: GpuInfo[] = [
    { vendor: "cuda", name: "NVIDIA CUDA", available: false, description: "Acceleration NVIDIA" },
    { vendor: "vulkan", name: "Vulkan", available: false, description: "GPU generique" },
    { vendor: "metal", name: "Apple Metal", available: false, description: "Acceleration macOS" },
    { vendor: "cpu", name: "CPU", available: true, description: "Sans acceleration" },
  ];

  const gpuTooltips: Record<GpuVendor, string> = {
    cuda: "Uniquement pour les cartes graphiques NVIDIA. Meilleure performance sur GPU NVIDIA.",
    vulkan: "Compatible AMD, NVIDIA et Intel. API graphique universelle multi-plateforme.",
    metal: "Exclusif aux Mac (Apple Silicon et Intel). Optimise pour macOS.",
    cpu: "Fonctionne partout, sans carte graphique. Plus lent mais universel.",
  };

  const mergedGpus = allGpuOptions.map((defaultGpu) => {
    const backendGpu = gpus.find((g) => g.vendor === defaultGpu.vendor);
    return backendGpu || defaultGpu;
  });

  // Tabs configuration
  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "engine", label: "Moteur", icon: <Settings2 className="h-4 w-4" /> },
    { id: "local", label: "Modele local", icon: <HardDrive className="h-4 w-4" /> },
    { id: "server", label: "Serveur", icon: <Globe className="h-4 w-4" /> },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-[oklch(0.22_0.015_260)] shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Transcription</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Configuration du moteur de reconnaissance vocale
            </p>
          </div>
          {currentModel && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-active)]/10 border border-[var(--color-active)]/20">
                <Activity className="h-3.5 w-3.5 text-[var(--color-active)]" />
                <span className="text-xs font-medium text-[var(--color-active)]">{currentModel}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onUnload}
                className="border-[oklch(0.28_0.015_260)] hover:bg-[oklch(0.20_0.015_260)] h-8"
              >
                <X className="h-3.5 w-3.5 mr-1.5" />
                Decharger
              </Button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 p-1 rounded-lg bg-[oklch(0.12_0.01_260)] border border-[oklch(0.22_0.015_260)] w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
                activeTab === tab.id
                  ? "bg-[oklch(0.20_0.015_260)] text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-[oklch(0.16_0.01_260)]"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-6">
          <div className="max-w-2xl mx-auto">

            {/* TAB: Moteur */}
            {activeTab === "engine" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground mb-6">
                  Choisissez comment la transcription sera effectuee.
                </p>

                {/* Mode Cards */}
                <div className="space-y-3">
                  {/* Local Mode */}
                  <button
                    onClick={() => handleEngineModeChange("local")}
                    className={cn(
                      "w-full p-5 rounded-xl border text-left transition-all duration-200",
                      engineMode === "local"
                        ? "border-[var(--color-active)] bg-gradient-to-br from-[var(--color-active)]/15 to-[var(--color-active)]/5"
                        : "border-[oklch(0.25_0.015_260)] bg-[oklch(0.14_0.01_260)] hover:bg-[oklch(0.16_0.01_260)] hover:border-[oklch(0.30_0.015_260)]"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "h-12 w-12 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                        engineMode === "local"
                          ? "bg-[var(--color-active)]/20 text-[var(--color-active)]"
                          : "bg-[oklch(0.20_0.015_260)] text-muted-foreground"
                      )}>
                        <ArrowDownToLine className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">Local uniquement</span>
                          {engineMode === "local" && (
                            <Check className="h-4 w-4 text-[var(--color-active)]" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Whisper tourne sur votre machine. Aucune donnee envoyee.
                        </p>
                        {currentModel ? (
                          <div className="flex items-center gap-1.5 mt-3 text-xs text-[var(--color-active)]">
                            <Activity className="h-3 w-3" />
                            <span>Modele actif : {currentModel}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 mt-3 text-xs text-[var(--color-warning)]">
                            <AlertCircle className="h-3 w-3" />
                            <span>Aucun modele charge</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Server Mode */}
                  <button
                    onClick={() => handleEngineModeChange("server")}
                    className={cn(
                      "w-full p-5 rounded-xl border text-left transition-all duration-200",
                      engineMode === "server"
                        ? "border-blue-500 bg-gradient-to-br from-blue-500/15 to-blue-500/5"
                        : "border-[oklch(0.25_0.015_260)] bg-[oklch(0.14_0.01_260)] hover:bg-[oklch(0.16_0.01_260)] hover:border-[oklch(0.30_0.015_260)]"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "h-12 w-12 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                        engineMode === "server"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-[oklch(0.20_0.015_260)] text-muted-foreground"
                      )}>
                        <Globe className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">Serveur uniquement</span>
                          {engineMode === "server" && (
                            <Check className="h-4 w-4 text-blue-400" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Transcription via serveur distant avec streaming temps reel.
                        </p>
                        <div className="flex items-center gap-1.5 mt-3">
                          {statusIcon("sm")}
                          <span className={cn(
                            "text-xs",
                            serverStatus === "online" ? "text-[var(--color-success)]" :
                            serverStatus === "offline" ? "text-[var(--color-destructive)]" :
                            "text-muted-foreground"
                          )}>
                            {statusText()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Server + Fallback Mode */}
                  <button
                    onClick={() => handleEngineModeChange("server_fallback")}
                    className={cn(
                      "w-full p-5 rounded-xl border text-left transition-all duration-200",
                      engineMode === "server_fallback"
                        ? "border-purple-500 bg-gradient-to-br from-purple-500/15 to-purple-500/5"
                        : "border-[oklch(0.25_0.015_260)] bg-[oklch(0.14_0.01_260)] hover:bg-[oklch(0.16_0.01_260)] hover:border-[oklch(0.30_0.015_260)]"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "h-12 w-12 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                        engineMode === "server_fallback"
                          ? "bg-purple-500/20 text-purple-400"
                          : "bg-[oklch(0.20_0.015_260)] text-muted-foreground"
                      )}>
                        <Shield className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">Serveur + Fallback local</span>
                          {engineMode === "server_fallback" && (
                            <Check className="h-4 w-4 text-purple-400" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Serveur en priorite, bascule en local si indisponible.
                        </p>
                        <div className="flex items-center gap-4 mt-3">
                          <div className="flex items-center gap-1.5">
                            {statusIcon("sm")}
                            <span className={cn(
                              "text-xs",
                              serverStatus === "online" ? "text-[var(--color-success)]" :
                              serverStatus === "offline" ? "text-[var(--color-destructive)]" :
                              "text-muted-foreground"
                            )}>
                              Serveur: {statusText()}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {currentModel ? (
                              <>
                                <Activity className="h-3.5 w-3.5 text-[var(--color-active)]" />
                                <span className="text-xs text-[var(--color-active)]">Local: {currentModel}</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="h-3.5 w-3.5 text-[var(--color-warning)]" />
                                <span className="text-xs text-[var(--color-warning)]">Local: non pret</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* TAB: Modele local */}
            {activeTab === "local" && (
              <div className="space-y-5">
                {/* GPU Selection */}
                <div className="p-5 rounded-xl border border-[oklch(0.25_0.015_260)] bg-[oklch(0.15_0.01_260)]">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-8 w-8 rounded-lg bg-[var(--color-warning)]/15 flex items-center justify-center">
                      <Zap className="h-4 w-4 text-[var(--color-warning)]" />
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
                          onClick={() => gpu.available && !isLoading && onGpuVendorChange(gpu.vendor)}
                          disabled={!gpu.available || isLoading}
                          className={cn(
                            "w-full p-3 rounded-lg border text-left transition-all duration-200",
                            currentGpuVendor === gpu.vendor
                              ? "border-[var(--color-warning)] bg-[var(--color-warning)]/10"
                              : gpu.available && !isLoading
                              ? "border-[oklch(0.25_0.015_260)] bg-[oklch(0.12_0.01_260)] hover:bg-[oklch(0.16_0.01_260)]"
                              : "opacity-40 cursor-not-allowed border-[oklch(0.22_0.015_260)] bg-[oklch(0.10_0.01_260)]"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "h-7 w-7 rounded-md flex items-center justify-center",
                              currentGpuVendor === gpu.vendor
                                ? "bg-[var(--color-warning)]/20 text-[var(--color-warning)]"
                                : "bg-[oklch(0.20_0.015_260)] text-muted-foreground"
                            )}>
                              {gpu.vendor === "cpu" ? <Cpu className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{gpu.name}</div>
                            </div>
                            {currentGpuVendor === gpu.vendor && (
                              isLoading
                                ? <Loader2 className="h-4 w-4 text-[var(--color-warning)] animate-spin shrink-0" />
                                : <Check className="h-4 w-4 text-[var(--color-warning)] shrink-0" />
                            )}
                          </div>
                        </button>
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover border border-[oklch(0.30_0.015_260)] rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-150 pointer-events-none z-50 w-56 text-center">
                          <p className="text-xs text-popover-foreground">{gpuTooltips[gpu.vendor]}</p>
                          {!gpu.available && (
                            <p className="text-[10px] text-muted-foreground mt-1">Non disponible sur cette machine</p>
                          )}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[oklch(0.30_0.015_260)]" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Models Selection */}
                <div className="p-5 rounded-xl border border-[oklch(0.25_0.015_260)] bg-[oklch(0.15_0.01_260)]">
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
                    <div className="flex gap-1 p-0.5 bg-[oklch(0.12_0.01_260)] rounded-md border border-[oklch(0.22_0.015_260)]">
                      <button
                        onClick={() => setModelFamily("quantized")}
                        className={cn(
                          "px-2.5 py-1 rounded text-xs font-medium transition-all",
                          modelFamily === "quantized"
                            ? "bg-[oklch(0.20_0.015_260)] text-foreground shadow-sm"
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
                            ? "bg-[oklch(0.20_0.015_260)] text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        Standard
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {filteredModels.map((model) => {
                      const isDownloaded = downloadedModels.includes(model.id);
                      const isLoaded = currentModel === model.id;
                      const isCurrentlyDownloading = isDownloading && downloadProgress?.model_id === model.id;

                      return (
                        <div
                          key={model.id}
                          className={cn(
                            "p-3 rounded-lg border transition-all duration-200",
                            isLoaded
                              ? "border-[var(--color-active)] bg-[var(--color-active)]/10"
                              : "border-[oklch(0.22_0.015_260)] bg-[oklch(0.12_0.01_260)]"
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{model.name}</span>
                                {isLoaded && (
                                  <span className="badge-active text-[10px] px-1.5 py-0.5 rounded">
                                    Actif
                                  </span>
                                )}
                                {isDownloaded && !isLoaded && (
                                  <Check className="h-3.5 w-3.5 text-[var(--color-success)]" />
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-muted-foreground">{model.size_mb} MB</span>
                                <span className="text-xs text-muted-foreground/50">•</span>
                                <span className="text-xs text-muted-foreground truncate">{model.description}</span>
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center gap-1.5">
                              {!isDownloaded ? (
                                <Button
                                  size="sm"
                                  onClick={() => onDownload(model.id)}
                                  disabled={isDownloading}
                                  className="h-7 px-2.5 text-xs bg-[var(--color-active)] text-[oklch(0.13_0.01_260)] hover:bg-[var(--color-active)]/90"
                                >
                                  {isCurrentlyDownloading ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <>
                                      <Download className="h-3.5 w-3.5 mr-1" />
                                      DL
                                    </>
                                  )}
                                </Button>
                              ) : isLoaded ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled
                                  className="h-7 px-2.5 text-xs bg-[var(--color-active)]/20 text-[var(--color-active)]"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => onLoad(model.id)}
                                    disabled={isLoading}
                                    className="h-7 px-2.5 text-xs border-[oklch(0.28_0.015_260)] hover:bg-[oklch(0.20_0.015_260)]"
                                    variant="outline"
                                  >
                                    {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Charger"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={async () => {
                                      setIsDeleting(model.id);
                                      try {
                                        await onDelete(model.id);
                                      } finally {
                                        setIsDeleting(null);
                                      }
                                    }}
                                    disabled={isDeleting === model.id}
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-[var(--color-destructive)] hover:bg-[var(--color-destructive)]/10"
                                  >
                                    {isDeleting === model.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>

                          {isCurrentlyDownloading && downloadProgress && (
                            <div className="mt-3 pt-3 border-t border-[oklch(0.22_0.015_260)] space-y-1.5">
                              <Progress value={downloadProgress.progress} className="h-1.5" />
                              <div className="flex justify-between text-[10px] text-muted-foreground">
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
              </div>
            )}

            {/* TAB: Serveur */}
            {activeTab === "server" && (
              <div className="space-y-5">
                {/* Server Connection */}
                <div className="p-5 rounded-xl border border-[oklch(0.25_0.015_260)] bg-[oklch(0.15_0.01_260)]">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-8 w-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                      <Server className="h-4 w-4 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-sm">Connexion</h3>
                      <p className="text-xs text-muted-foreground">Endpoint du serveur Whisper</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* URL + Test */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">URL du serveur</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          onBlur={() => urlInput !== serverUrl && saveServerUrl()}
                          onKeyDown={(e) => e.key === "Enter" && saveServerUrl()}
                          placeholder="http://localhost:8000"
                          className="flex-1 px-3 py-2 text-sm rounded-lg border border-[oklch(0.25_0.015_260)] bg-[oklch(0.12_0.01_260)] focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-mono"
                        />
                        <button
                          onClick={() => checkServerHealth(false)}
                          disabled={serverStatus === "checking"}
                          className={cn(
                            "px-3 py-2 rounded-lg border transition-all duration-200",
                            serverStatus === "online"
                              ? "border-[var(--color-success)]/30 bg-[var(--color-success)]/10 text-[var(--color-success)]"
                              : serverStatus === "offline"
                              ? "border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/10 text-[var(--color-destructive)]"
                              : "border-[oklch(0.28_0.015_260)] hover:bg-[oklch(0.20_0.015_260)]"
                          )}
                        >
                          <RefreshCw className={cn("h-4 w-4", serverStatus === "checking" && "animate-spin")} />
                        </button>
                      </div>
                      {urlError && <p className="text-xs text-[var(--color-destructive)]">{urlError}</p>}
                    </div>

                    {/* Status */}
                    <div className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg",
                      serverStatus === "online"
                        ? "bg-[var(--color-success)]/10 border border-[var(--color-success)]/20"
                        : serverStatus === "offline"
                        ? "bg-[var(--color-destructive)]/10 border border-[var(--color-destructive)]/20"
                        : "bg-[oklch(0.12_0.01_260)] border border-[oklch(0.22_0.015_260)]"
                    )}>
                      {statusIcon()}
                      <span className="text-sm">{statusText()}</span>
                    </div>
                  </div>
                </div>

                {/* Timeout */}
                <div className="p-5 rounded-xl border border-[oklch(0.25_0.015_260)] bg-[oklch(0.15_0.01_260)]">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-8 w-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                      <Clock className="h-4 w-4 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-sm">Timeout</h3>
                      <p className="text-xs text-muted-foreground">Delai maximum pour la transcription</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {timeoutOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => onServerTimeoutChange(option.value)}
                        className={cn(
                          "px-3 py-2 text-sm font-medium rounded-lg border transition-all duration-200",
                          serverTimeout === option.value
                            ? "border-blue-500 bg-blue-500/15 text-blue-400"
                            : "border-[oklch(0.25_0.015_260)] bg-[oklch(0.12_0.01_260)] hover:bg-[oklch(0.18_0.015_260)] text-muted-foreground"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* SSE Info */}
                <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/10">
                  <div className="flex items-start gap-3">
                    <Activity className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-blue-400">Streaming SSE</p>
                      <p className="text-xs text-blue-300/70 mt-1">
                        Le serveur envoie les segments en temps reel. Le texte apparait progressivement dans l'overlay pendant la transcription.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
