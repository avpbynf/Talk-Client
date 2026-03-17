import { useState } from "react";
import { Activity, Globe, HardDrive, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type {
  ModelInfo,
  DownloadProgress,
  GpuInfo,
  GpuVendor,
  TranscriptionMode,
} from "@/App";
import { EngineTab } from "./EngineTab";
import { LocalTab } from "./LocalTab";
import { ServerTab } from "./ServerTab";

export type ServerStatus = "unknown" | "checking" | "online" | "offline";
export type EngineMode = "local" | "server" | "server_fallback";
export type TabId = "engine" | "local" | "server";

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
  serverStatus: ServerStatus;
  checkServerHealth: (silent?: boolean) => void;
}

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "engine", label: "Moteur", icon: <Settings2 className="h-4 w-4" /> },
  { id: "local", label: "Modele local", icon: <HardDrive className="h-4 w-4" /> },
  { id: "server", label: "Serveur", icon: <Globe className="h-4 w-4" /> },
];

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
  serverStatus,
  checkServerHealth,
}: TranscriptionViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>("engine");

  // Derive engine mode from props
  const engineMode: EngineMode =
    transcriptionMode === "local"
      ? "local"
      : serverFallback
      ? "server_fallback"
      : "server";

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

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border-subtle shrink-0">
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
                className="border-border hover:bg-surface-active h-8"
              >
                <X className="h-3.5 w-3.5 mr-1.5" />
                Decharger
              </Button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 p-1 rounded-lg bg-surface-inset border border-border-subtle w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
                activeTab === tab.id
                  ? "bg-surface-active text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-card"
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
            {activeTab === "engine" && (
              <EngineTab
                engineMode={engineMode}
                onEngineModeChange={handleEngineModeChange}
                currentModel={currentModel}
                serverStatus={serverStatus}
              />
            )}
            {activeTab === "local" && (
              <LocalTab
                models={models}
                downloadedModels={downloadedModels}
                currentModel={currentModel}
                isDownloading={isDownloading}
                downloadProgress={downloadProgress}
                isLoading={isLoading}
                gpus={gpus}
                currentGpuVendor={currentGpuVendor}
                onDownload={onDownload}
                onLoad={onLoad}
                onDelete={onDelete}
                onGpuVendorChange={onGpuVendorChange}
              />
            )}
            {activeTab === "server" && (
              <ServerTab
                serverUrl={serverUrl}
                serverTimeout={serverTimeout}
                serverStatus={serverStatus}
                onServerUrlChange={onServerUrlChange}
                onServerTimeoutChange={onServerTimeoutChange}
                checkServerHealth={checkServerHealth}
              />
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
