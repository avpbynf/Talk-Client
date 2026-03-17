import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ServerStatus } from "@/views/transcription/TranscriptionView";
import { listen } from "@tauri-apps/api/event";
import { History, Mic, Settings, BookText } from "lucide-react";
import { Titlebar } from "@/components/Titlebar";
import { cn } from "@/lib/utils";
import HistoryView from "@/views/HistoryView";
import TranscriptionView from "@/views/transcription/TranscriptionView";
import VocabularyView from "@/views/VocabularyView";
import PreferencesView from "@/views/PreferencesView";
import SetupWizard from "@/pages/SetupWizard";

export interface ModelInfo {
  id: string;
  name: string;
  size_mb: number;
  description: string;
}

export interface DownloadProgress {
  model_id: string;
  progress: number;
  downloaded_mb: number;
  total_mb: number;
}

export interface Transcription {
  id: string;
  text: string;
  timestamp: Date;
  model: string | null;
  enhanced: boolean;
}

export type RecordingMode = "push_to_talk" | "toggle";
export type AcceleratorBackend = "cpu" | "vulkan";
export type GpuVendor = "vulkan" | "cpu";
export type OverlaySize = "small" | "medium" | "large";
export type TranscriptionMode = "local" | "server";

export interface AcceleratorInfo {
  backend: AcceleratorBackend;
  name: string;
  available: boolean;
  description: string;
}

export interface GpuInfo {
  vendor: GpuVendor;
  name: string;
  available: boolean;
  description: string;
}

interface SavedSettings {
  last_model: string | null;
  accelerator_backend: AcceleratorBackend;
  overlay_size: OverlaySize;
  vocabulary: string[];
  transcription_mode: TranscriptionMode;
  server_url: string;
  server_fallback: boolean;
  server_timeout: number;
  pause_media_on_record: boolean;
  preserve_clipboard: boolean;
}

interface HotkeyConfig {
  shortcut: string;
  cancel_shortcut: string;
  mode: RecordingMode;
}

interface SavedTranscription {
  id: string;
  text: string;
  timestamp: string;
  model: string | null;
  enhanced: boolean;
}

type View = "history" | "transcription" | "vocabulary" | "preferences";

function App() {
  const [setupCompleted, setSetupCompleted] = useState<boolean | null>(null);
  const [currentView, setCurrentView] = useState<View>("history");
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [downloadedModels, setDownloadedModels] = useState<string[]>([]);
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [recordingMode, setRecordingMode] = useState<RecordingMode>("push_to_talk");
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [shortcut, setShortcut] = useState("Ctrl+Space");
  const [cancelShortcut, setCancelShortcut] = useState("Ctrl+F1");
  const [gpus, setGpus] = useState<GpuInfo[]>([]);
  const [currentGpuVendor, setCurrentGpuVendor] = useState<GpuVendor>("cpu");
  const [overlaySize, setOverlaySize] = useState<OverlaySize>("medium");
  const [vocabulary, setVocabulary] = useState<string[]>([]);
  const [transcriptionMode, setTranscriptionMode] = useState<TranscriptionMode>("local");
  const [serverUrl, setServerUrl] = useState("https://stt.example.com");
  const [serverFallback, setServerFallback] = useState(true);
  const [serverTimeout, setServerTimeout] = useState(30000);
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [startMinimized, setStartMinimized] = useState(false);
  const [pauseMediaOnRecord, setPauseMediaOnRecord] = useState(false);
  const [preserveClipboard, setPreserveClipboard] = useState(false);
  const [serverStatus, setServerStatus] = useState<ServerStatus>("unknown");
  const isCheckingServerRef = useRef(false);

  // Refs to avoid re-registering listeners
  const currentModelRef = useRef<string | null>(null);
  const hasInitialized = useRef(false);

  // Keep refs in sync with state
  useEffect(() => {
    currentModelRef.current = currentModel;
  }, [currentModel]);

  // Check setup status first
  useEffect(() => {
    invoke<boolean>("is_setup_completed").then(setSetupCompleted);
  }, []);

  // Initialize app only once on mount (guard against StrictMode double-call)
  useEffect(() => {
    if (hasInitialized.current) return;
    if (setupCompleted !== true) return; // Don't initialize until setup is complete
    hasInitialized.current = true;
    initializeApp();
  }, [setupCompleted]);

  // Event listeners - register only once (with StrictMode guard)
  const hasRegisteredListeners = useRef(false);
  useEffect(() => {
    if (hasRegisteredListeners.current) return;
    hasRegisteredListeners.current = true;

    const unlistenProgress = listen<DownloadProgress>("download-progress", (event) => {
      setDownloadProgress(event.payload);
    });

    const unlistenComplete = listen<{ model_id: string }>("download-complete", (event) => {
      setIsDownloading(false);
      setDownloadProgress(null);
      setDownloadedModels((prev) => [...prev, event.payload.model_id]);
    });

    const unlistenTranscription = listen<string>("transcription-complete", (event) => {
      const newTranscription: Transcription = {
        id: Date.now().toString(),
        text: event.payload,
        timestamp: new Date(),
        model: currentModelRef.current,
        enhanced: false,
      };
      setTranscriptions((prev) => {
        const updated = [newTranscription, ...prev].slice(0, 100);
        // Save to disk
        invoke("save_transcription_history", {
          history: updated.map((t) => ({
            ...t,
            timestamp: t.timestamp.toISOString(),
          })),
        });
        return updated;
      });
    });

    const unlistenRecordingStarted = listen("recording-started", () => {
      setIsRecording(true);
    });

    const unlistenRecordingStopped = listen("recording-stopped", () => {
      setIsRecording(false);
    });

    const unlistenRecordingCancelled = listen("recording-cancelled", () => {
      setIsRecording(false);
    });

    const unlistenModelDeleted = listen<{ model_id: string }>("model-deleted", (event) => {
      setDownloadedModels((prev) => prev.filter((id) => id !== event.payload.model_id));
    });

    return () => {
      unlistenProgress.then((f) => f());
      unlistenComplete.then((f) => f());
      unlistenTranscription.then((f) => f());
      unlistenRecordingStarted.then((f) => f());
      unlistenRecordingStopped.then((f) => f());
      unlistenRecordingCancelled.then((f) => f());
      unlistenModelDeleted.then((f) => f());
    };
  }, []);

  async function initializeApp() {
    // Load basic data
    const [availableModels, downloaded, hotkeyConfig, savedHistory, availableGpus, currentVendor, autostart, startMin] = await Promise.all([
      invoke<ModelInfo[]>("get_available_models"),
      invoke<string[]>("get_downloaded_models"),
      invoke<HotkeyConfig>("get_hotkey_config"),
      invoke<SavedTranscription[]>("get_transcription_history"),
      invoke<GpuInfo[]>("get_available_gpus"),
      invoke<GpuVendor>("get_current_gpu_vendor"),
      invoke<boolean>("get_autostart_enabled"),
      invoke<boolean>("get_start_minimized"),
    ]);

    setModels(availableModels);
    setDownloadedModels(downloaded);
    setRecordingMode(hotkeyConfig.mode);
    setShortcut(hotkeyConfig.shortcut);
    setCancelShortcut(hotkeyConfig.cancel_shortcut || "Ctrl+F1");
    setGpus(availableGpus);
    setCurrentGpuVendor(currentVendor);
    setAutostartEnabled(autostart);
    setStartMinimized(startMin);

    // Restore transcription history
    if (savedHistory.length > 0) {
      setTranscriptions(
        savedHistory.map((t) => ({
          ...t,
          timestamp: new Date(t.timestamp),
        }))
      );
    }

    // Load saved settings and apply them
    const savedSettings = await invoke<SavedSettings>("get_saved_settings");
    setOverlaySize(savedSettings.overlay_size || "medium");
    setVocabulary(savedSettings.vocabulary || []);
    setTranscriptionMode(savedSettings.transcription_mode || "local");
    setServerUrl(savedSettings.server_url || "https://stt.example.com");
    setServerFallback(savedSettings.server_fallback !== false); // Default to true
    setServerTimeout(savedSettings.server_timeout || 30000);
    setPauseMediaOnRecord(savedSettings.pause_media_on_record || false);
    setPreserveClipboard(savedSettings.preserve_clipboard || false);

    // Auto-load last used model if it's downloaded
    // Only load if: mode is "local" OR (mode is "server" AND fallback is enabled)
    const needsLocalModel =
      savedSettings.transcription_mode === "local" ||
      (savedSettings.transcription_mode === "server" && savedSettings.server_fallback !== false);

    if (needsLocalModel && savedSettings.last_model && downloaded.includes(savedSettings.last_model)) {
      setIsLoading(true);
      try {
        await invoke("load_model", { modelId: savedSettings.last_model });
        setCurrentModel(savedSettings.last_model);
      } catch (error) {
        console.error("Failed to auto-load model:", error);
      } finally {
        setIsLoading(false);
      }
    }
  }

  const checkServerHealth = async (silent = false) => {
    if (isCheckingServerRef.current) return;
    isCheckingServerRef.current = true;
    if (!silent) setServerStatus("checking");
    try {
      const isHealthy = await invoke<boolean>("check_server_health");
      setServerStatus(isHealthy ? "online" : "offline");
    } catch {
      setServerStatus("offline");
    } finally {
      isCheckingServerRef.current = false;
    }
  };

  // Server health polling when in server mode
  useEffect(() => {
    if (transcriptionMode !== "server") return;
    checkServerHealth(false);
    const interval = setInterval(() => checkServerHealth(true), 5000);
    return () => clearInterval(interval);
  }, [transcriptionMode, serverUrl]);

  const navItems = [
    { id: "history" as View, icon: History, label: "Historique" },
    { id: "transcription" as View, icon: Mic, label: "Transcription" },
    { id: "vocabulary" as View, icon: BookText, label: "Vocabulaire" },
    { id: "preferences" as View, icon: Settings, label: "Preferences" },
  ];

  // Show loading state while checking setup status
  if (setupCompleted === null) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  // Show setup wizard if not completed
  if (!setupCompleted) {
    return (
      <SetupWizard
        onComplete={() => {
          setSetupCompleted(true);
          // Trigger app initialization after setup
          hasInitialized.current = false;
        }}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden noise-overlay">
      {/* Titlebar */}
      <Titlebar isRecording={isRecording} />

      {/* Main layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Sidebar */}
        <div className="w-[72px] border-r border-border-subtle bg-surface-inset flex flex-col items-center py-5 gap-2 shrink-0">
          {/* Nav items */}
          {navItems.map((item, index) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={cn(
                "nav-indicator w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 relative group press-effect",
                currentView === item.id
                  ? "active bg-secondary text-[var(--color-active)] shadow-[inset_0_1px_0_oklch(1_0_0/0.05)]"
                  : "hover:bg-surface-elevated text-muted-foreground hover:text-foreground"
              )}
              style={{ animationDelay: `${index * 0.05}s` }}
              title={item.label}
            >
              <item.icon className="h-5 w-5" strokeWidth={currentView === item.id ? 2 : 1.5} />
              {/* Tooltip */}
              <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-popover text-popover-foreground text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-150 whitespace-nowrap pointer-events-none z-50 border border-border-hover shadow-lg tooltip-enter translate-x-1 group-hover:translate-x-0">
                {item.label}
              </span>
            </button>
          ))}

          {/* Status indicator at bottom */}
          <div className="mt-auto flex flex-col items-center gap-2">
            {(() => {
              const isServerMode = transcriptionMode === "server" && !serverFallback;
              const isHybridMode = transcriptionMode === "server" && serverFallback;

              let dotState: "success" | "warning" | "destructive";
              let dotTitle: string;

              if (isServerMode) {
                dotState = serverStatus === "online" ? "success" : serverStatus === "offline" ? "destructive" : "warning";
                const statusLabel = serverStatus === "online" ? "connecte" : serverStatus === "offline" ? "indisponible" : "non teste";
                dotTitle = `Serveur: ${statusLabel}`;
              } else if (isHybridMode) {
                const serverOk = serverStatus === "online";
                const localOk = currentModel !== null;
                dotState = serverOk || localOk ? "success" : serverStatus === "offline" && !localOk ? "destructive" : "warning";
                const statusLabel = serverStatus === "online" ? "connecte" : serverStatus === "offline" ? "indisponible" : "non teste";
                dotTitle = `Serveur: ${statusLabel} | Local: ${currentModel || "non pret"}`;
              } else {
                dotState = currentModel ? "success" : "warning";
                dotTitle = currentModel ? `Modele: ${currentModel}` : "Aucun modele charge";
              }

              return (
                <div
                  className={cn(
                    "h-2.5 w-2.5 rounded-full transition-all duration-300",
                    dotState === "success" && "bg-success shadow-[0_0_8px_oklch(from_var(--color-success)_l_c_h/0.5)]",
                    dotState === "warning" && "bg-warning shadow-[0_0_6px_oklch(from_var(--color-warning)_l_c_h/0.4)]",
                    dotState === "destructive" && "bg-destructive shadow-[0_0_6px_oklch(from_var(--color-destructive)_l_c_h/0.4)]"
                  )}
                  title={dotTitle}
                />
              );
            })()}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-h-0 min-w-0 view-enter" key={currentView}>
        {currentView === "history" && (
          <HistoryView
            transcriptions={transcriptions}
            onClear={() => {
              setTranscriptions([]);
              invoke("save_transcription_history", { history: [] });
            }}
            shortcut={shortcut}
          />
        )}
        {currentView === "transcription" && (
          <TranscriptionView
            models={models}
            downloadedModels={downloadedModels}
            currentModel={currentModel}
            isDownloading={isDownloading}
            downloadProgress={downloadProgress}
            isLoading={isLoading}
            onDownload={async (modelId) => {
              setIsDownloading(true);
              try {
                await invoke("download_model", { modelId });
              } catch (error) {
                console.error("Download failed:", error);
                setIsDownloading(false);
              }
            }}
            onLoad={async (modelId) => {
              setIsLoading(true);
              try {
                await invoke("load_model", { modelId });
                setCurrentModel(modelId);
              } catch (error) {
                console.error("Failed to load model:", error);
              } finally {
                setIsLoading(false);
              }
            }}
            onUnload={async () => {
              try {
                await invoke("unload_model");
                setCurrentModel(null);
              } catch (error) {
                console.error("Failed to unload model:", error);
              }
            }}
            onDelete={async (modelId) => {
              try {
                await invoke("delete_model", { modelId });
              } catch (error) {
                console.error("Failed to delete model:", error);
              }
            }}
            gpus={gpus}
            currentGpuVendor={currentGpuVendor}
            onGpuVendorChange={async (vendor) => {
              setCurrentGpuVendor(vendor);
              setIsLoading(true);
              try {
                await invoke("set_gpu_vendor", { vendor });
              } catch (error) {
                console.error("Failed to change GPU:", error);
              } finally {
                setIsLoading(false);
              }
            }}
            transcriptionMode={transcriptionMode}
            onTranscriptionModeChange={async (mode) => {
              setTranscriptionMode(mode);
              await invoke("set_transcription_mode", { mode });
            }}
            serverUrl={serverUrl}
            onServerUrlChange={async (url) => {
              setServerUrl(url);
              await invoke("set_server_url", { url });
            }}
            serverFallback={serverFallback}
            onServerFallbackChange={async (enabled) => {
              setServerFallback(enabled);
              await invoke("set_server_fallback", { enabled });
            }}
            serverTimeout={serverTimeout}
            onServerTimeoutChange={async (timeout) => {
              setServerTimeout(timeout);
              await invoke("set_server_timeout", { timeout });
            }}
            serverStatus={serverStatus}
            checkServerHealth={checkServerHealth}
          />
        )}
        {currentView === "vocabulary" && (
          <VocabularyView
            vocabulary={vocabulary}
            onVocabularyChange={setVocabulary}
          />
        )}
        {currentView === "preferences" && (
          <PreferencesView
            recordingMode={recordingMode}
            onRecordingModeChange={async (mode) => {
              setRecordingMode(mode);
              await invoke("set_recording_mode", { mode });
            }}
            shortcut={shortcut}
            onShortcutChange={async (newShortcut) => {
              await invoke("update_shortcut", { shortcut: newShortcut });
              setShortcut(newShortcut);
            }}
            cancelShortcut={cancelShortcut}
            onCancelShortcutChange={async (newShortcut) => {
              await invoke("update_cancel_shortcut", { shortcut: newShortcut });
              setCancelShortcut(newShortcut);
            }}
            overlaySize={overlaySize}
            onOverlaySizeChange={async (size) => {
              setOverlaySize(size);
              await invoke("set_overlay_size", { size });
            }}
            autostartEnabled={autostartEnabled}
            onAutostartChange={async (enabled) => {
              setAutostartEnabled(enabled);
              await invoke("set_autostart_enabled", { enabled });
            }}
            startMinimized={startMinimized}
            onStartMinimizedChange={async (enabled) => {
              setStartMinimized(enabled);
              await invoke("set_start_minimized", { enabled });
            }}
            pauseMediaOnRecord={pauseMediaOnRecord}
            onPauseMediaOnRecordChange={async (enabled) => {
              setPauseMediaOnRecord(enabled);
              await invoke("set_pause_media_on_record", { enabled });
            }}
            preserveClipboard={preserveClipboard}
            onPreserveClipboardChange={async (enabled) => {
              setPreserveClipboard(enabled);
              await invoke("set_preserve_clipboard", { enabled });
            }}
          />
        )}
      </div>
      </div>
    </div>
  );
}

export default App;
