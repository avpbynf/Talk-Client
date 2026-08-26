import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ServerStatus } from "@/views/transcription/TranscriptionView";
import { listen } from "@tauri-apps/api/event";
import { History, Cpu, Settings, BookA, Palette, LayoutDashboard } from "lucide-react";
import { Titlebar } from "@/components/Titlebar";
import { cn } from "@/lib/utils";
import HistoryView from "@/views/HistoryView";
import TranscriptionView from "@/views/transcription/TranscriptionView";
import VocabularyView from "@/views/VocabularyView";
import PreferencesView from "@/views/PreferencesView";
import AppearanceView from "@/views/AppearanceView";
import AnalyticsView from "@/views/AnalyticsView";
import SetupWizard from "@/pages/SetupWizard";
import { type AppThemeId, applyAppTheme } from "@/lib/app-themes";

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
  source: "local" | "server";
}

export type RecordingMode = "push_to_talk" | "toggle";
export type AcceleratorBackend = "cpu" | "vulkan";
export type GpuVendor = "vulkan" | "cpu";
export type OverlaySize = "small" | "medium" | "large";
export type OverlayTheme = "aurora" | "sunset" | "ocean" | "neon" | "frost" | "neutral";
export type AppTheme = "talk-dark" | "talk-light" | "zed" | "vscode-dark" | "vscode-light" | "dracula" | "nord";
export type TranscriptionMode = "local" | "server";

export type CompanionShortcut = {
  id: string;
  label: string;
  keys: string;
  trigger: "start" | "stop" | "both";
};

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
  overlay_theme: OverlayTheme;
  app_theme: AppTheme;
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
  source: string;
  audioDurationMs: number | null;
  processingTimeMs: number | null;
  wordCount: number;
  charCount: number;
}

type View = "analytics" | "history" | "transcription" | "vocabulary" | "preferences" | "appearance";

function App() {
  const [setupCompleted, setSetupCompleted] = useState<boolean | null>(null);
  const [currentView, setCurrentView] = useState<View>("analytics");
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [downloadedModels, setDownloadedModels] = useState<string[]>([]);
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [recordingMode, setRecordingMode] = useState<RecordingMode>("push_to_talk");
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [, setIsRecording] = useState(false);
  const [shortcut, setShortcut] = useState("Ctrl+Space");
  const [cancelShortcut, setCancelShortcut] = useState("Ctrl+F1");
  const [gpus, setGpus] = useState<GpuInfo[]>([]);
  const [currentGpuVendor, setCurrentGpuVendor] = useState<GpuVendor>("cpu");
  const [vocabulary, setVocabulary] = useState<string[]>([]);
  const [transcriptionMode, setTranscriptionMode] = useState<TranscriptionMode>("local");
  const [serverUrl, setServerUrl] = useState("");
  const [serverFallback, setServerFallback] = useState(true);
  const [serverTimeout, setServerTimeout] = useState(30000);
  const [serverToken, setServerToken] = useState("");
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [startMinimized, setStartMinimized] = useState(false);
  const [pauseMediaOnRecord, setPauseMediaOnRecord] = useState(false);
  const [preserveClipboard, setPreserveClipboard] = useState(false);
  const [serverStatus, setServerStatus] = useState<ServerStatus>("unknown");
  const isCheckingServerRef = useRef(false);
  const [soundFeedback, setSoundFeedback] = useState(false);
  const [startSound, setStartSound] = useState("none");
  const [stopSound, setStopSound] = useState("none");
  const [companionShortcuts, setCompanionShortcuts] = useState<CompanionShortcut[]>([]);
  const [overlayTheme, setOverlayTheme] = useState<OverlayTheme>("frost");
  const [overlaySize, setOverlaySize] = useState<OverlaySize>("small");
  const [appTheme, setAppTheme] = useState<AppThemeId>("talk-dark");

  // Refs to avoid re-registering listeners
  const currentModelRef = useRef<string | null>(null);
  const transcriptionModeRef = useRef(transcriptionMode);
  const hasInitialized = useRef(false);
  const companionShortcutsRef = useRef(companionShortcuts);

  // Keep refs in sync with state
  useEffect(() => {
    currentModelRef.current = currentModel;
  }, [currentModel]);

  useEffect(() => {
    transcriptionModeRef.current = transcriptionMode;
  }, [transcriptionMode]);

  useEffect(() => { companionShortcutsRef.current = companionShortcuts; }, [companionShortcuts]);

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

  const fireCompanionShortcuts = (phase: "start" | "stop") => {
    const shortcuts = companionShortcutsRef.current.filter(
      (c) => c.keys && (c.trigger === phase || c.trigger === "both")
    );
    for (const c of shortcuts) {
      invoke("simulate_keystroke_cmd", { keys: c.keys }).catch((err) =>
        console.error(`[companion] "${c.label}" failed:`, err)
      );
    }
  };

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
      const now = new Date();
      const source = transcriptionModeRef.current === "local" ? "local" : "server";
      const newTranscription: Transcription = {
        id: Date.now().toString(),
        text: event.payload,
        timestamp: now,
        model: currentModelRef.current,
        enhanced: false,
        source,
      };
      setTranscriptions((prev) => [newTranscription, ...prev]);
      // Persist to SQLite
      invoke("db_add_transcription", {
        entry: {
          id: newTranscription.id,
          text: newTranscription.text,
          timestamp: now.toISOString(),
          model: currentModelRef.current,
          source,
          enhanced: false,
          audioDurationMs: null,
          processingTimeMs: null,
        },
      });
    });

    const unlistenRecordingStarted = listen("recording-started", () => {
      setIsRecording(true);
      fireCompanionShortcuts("start");
    });

    const unlistenRecordingStopped = listen("recording-stopped", () => {
      setIsRecording(false);
      fireCompanionShortcuts("stop");
    });

    const unlistenRecordingCancelled = listen("recording-cancelled", () => {
      setIsRecording(false);
      fireCompanionShortcuts("stop");
    });

    const unlistenModelDeleted = listen<{ model_id: string }>("model-deleted", (event) => {
      setDownloadedModels((prev) => prev.filter((id) => id !== event.payload.model_id));
    });

    return () => {
      hasRegisteredListeners.current = false;
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
      invoke<SavedTranscription[]>("db_get_transcriptions", { limit: 200, offset: 0 }),
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

    // Restore transcription history from SQLite
    if (savedHistory.length > 0) {
      setTranscriptions(
        savedHistory.map((t) => ({
          id: t.id,
          text: t.text,
          timestamp: new Date(t.timestamp),
          model: t.model,
          enhanced: t.enhanced,
          source: (t.source === "server" ? "server" : "local") as "local" | "server",
        }))
      );
    }

    // Load saved settings and apply them
    const savedSettings = await invoke<SavedSettings>("get_saved_settings");
    setVocabulary(savedSettings.vocabulary || []);
    setTranscriptionMode(savedSettings.transcription_mode || "local");
    setServerUrl(savedSettings.server_url || "");
    setServerFallback(savedSettings.server_fallback !== false); // Default to true
    setServerTimeout(savedSettings.server_timeout || 30000);
    setPauseMediaOnRecord(savedSettings.pause_media_on_record || false);
    setPreserveClipboard(savedSettings.preserve_clipboard || false);
    setOverlayTheme(savedSettings.overlay_theme || "frost");
    setOverlaySize(savedSettings.overlay_size || "small");

    const savedAppTheme = (savedSettings.app_theme || "talk-dark") as AppThemeId;
    setAppTheme(savedAppTheme);
    applyAppTheme(savedAppTheme);

    const savedToken = await invoke<string>("get_server_token").catch(() => "");
    setServerToken(savedToken);

    const [sf, ss, es, companions] = await Promise.all([
      invoke<boolean>("get_sound_feedback").catch(() => false),
      invoke<string>("get_start_sound").catch(() => "none"),
      invoke<string>("get_stop_sound").catch(() => "none"),
      invoke<CompanionShortcut[]>("get_companion_shortcuts").catch(() => []),
    ]);
    setSoundFeedback(sf);
    setStartSound(ss);
    setStopSound(es);
    setCompanionShortcuts(companions);

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

  const navItemsTop = [
    { id: "analytics" as View, icon: LayoutDashboard, label: "Dashboard" },
    { id: "history" as View, icon: History, label: "History" },
    { id: "vocabulary" as View, icon: BookA, label: "Vocabulary" },
  ];
  const navItemsBottom = [
    { id: "appearance" as View, icon: Palette, label: "Appearance" },
    { id: "transcription" as View, icon: Cpu, label: "Transcription" },
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
      <Titlebar
        statusLabel={(() => {
          const isServerMode = transcriptionMode === "server" && !serverFallback;
          const isHybridMode = transcriptionMode === "server" && serverFallback;
          if (isServerMode) {
            return serverStatus === "online" ? "Server connected" : serverStatus === "offline" ? "Server unreachable" : "Server";
          } else if (isHybridMode) {
            return serverStatus === "online" ? "Server connected" : currentModel || "Not ready";
          }
          return currentModel || "No model";
        })()}
      />

      {/* Main layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Sidebar */}
        <div className="w-[72px] shrink-0 bg-surface-inset border-r border-border-subtle flex flex-col items-center py-4">
          {/* Top group */}
          <div className="flex flex-col gap-2 w-full px-2">
            {navItemsTop.map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={cn(
                  "w-full aspect-square flex flex-col items-center justify-center rounded-xl transition-all duration-200 group relative",
                  currentView === item.id
                    ? "bg-surface-active text-[var(--color-active)] shadow-sm"
                    : "text-muted-foreground hover:bg-surface-raised hover:text-foreground"
                )}
                title={item.label}
              >
                <item.icon size={22} strokeWidth={currentView === item.id ? 2.5 : 2} />
              </button>
            ))}
          </div>

          {/* Bottom group */}
          <div className="mt-auto flex flex-col gap-2 w-full px-2">
            {navItemsBottom.map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={cn(
                  "w-full aspect-square flex flex-col items-center justify-center rounded-xl transition-all duration-200 group relative opacity-80 hover:opacity-100",
                  currentView === item.id
                    ? "bg-surface-active text-foreground shadow-sm opacity-100"
                    : "text-muted-foreground hover:bg-surface-raised hover:text-foreground"
                )}
                title={item.label}
              >
                <item.icon size={20} strokeWidth={currentView === item.id ? 2.5 : 2} />
              </button>
            ))}
          </div>

        </div>

        {/* Main content */}
        <div className="flex-1 min-h-0 min-w-0 view-enter" key={currentView}>
        {currentView === "analytics" && (
          <AnalyticsView
            transcriptionMode={transcriptionMode}
            serverStatus={serverStatus}
            serverUrl={serverUrl}
            serverFallback={serverFallback}
            currentModel={currentModel}
            shortcut={shortcut}
          />
        )}
        {currentView === "history" && (
          <HistoryView
            transcriptions={transcriptions}
            onClear={() => {
              setTranscriptions([]);
              invoke("db_clear_transcriptions");
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
            serverToken={serverToken}
            onServerTokenChange={async (token) => {
              setServerToken(token);
              await invoke("set_server_token", { token });
            }}
          />
        )}
        {currentView === "vocabulary" && (
          <VocabularyView
            vocabulary={vocabulary}
            onVocabularyChange={setVocabulary}
          />
        )}
        {currentView === "appearance" && (
          <AppearanceView
            overlayTheme={overlayTheme}
            onOverlayThemeChange={async (theme) => {
              setOverlayTheme(theme);
              await invoke("set_overlay_theme", { theme });
            }}
            overlaySize={overlaySize}
            onOverlaySizeChange={async (size) => {
              setOverlaySize(size);
              await invoke("set_overlay_size", { size });
            }}
            appTheme={appTheme}
            onAppThemeChange={async (theme) => {
              setAppTheme(theme);
              applyAppTheme(theme);
              await invoke("set_app_theme", { theme });
            }}
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
            companionShortcuts={companionShortcuts}
            onCompanionShortcutsChange={async (shortcuts) => {
              setCompanionShortcuts(shortcuts);
              await invoke("set_companion_shortcuts", { shortcuts });
            }}
            soundFeedback={soundFeedback}
            onSoundFeedbackChange={async (enabled) => {
              setSoundFeedback(enabled);
              await invoke("set_sound_feedback", { enabled });
            }}
            startSound={startSound}
            onStartSoundChange={async (preset) => {
              setStartSound(preset);
              await invoke("set_start_sound", { preset });
            }}
            stopSound={stopSound}
            onStopSoundChange={async (preset) => {
              setStopSound(preset);
              await invoke("set_stop_sound", { preset });
            }}
          />
        )}
      </div>
      </div>
    </div>
  );
}

export default App;
