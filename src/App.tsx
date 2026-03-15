import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { History, Mic, Sparkles, Settings, BookText } from "lucide-react";
import { Titlebar } from "@/components/Titlebar";
import { cn } from "@/lib/utils";
import HistoryView from "@/views/HistoryView";
import TranscriptionView from "@/views/TranscriptionView";
import VocabularyView from "@/views/VocabularyView";
import ClaudeView from "@/views/ClaudeView";
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
export type ClaudeModel = "haiku" | "sonnet" | "opus";
export type AcceleratorBackend = "cpu" | "cuda" | "vulkan" | "intel_sycl" | "metal";
export type GpuVendor = "cuda" | "vulkan" | "metal" | "cpu";
export type OverlaySize = "small" | "medium" | "large";
export type ScreenshotMode = "all_screens" | "primary_only";
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
  use_llm_enhancement: boolean;
  claude_model: ClaudeModel;
  accelerator_backend: AcceleratorBackend;
  overlay_size: OverlaySize;
  use_screenshot_for_correction: boolean;
  paste_screenshot_path: boolean;
  screenshot_mode: ScreenshotMode;
  vocabulary: string[];
  transcription_mode: TranscriptionMode;
  server_url: string;
  server_fallback: boolean;
  server_timeout: number;
  server_token: string | null;
  pause_media_on_record: boolean;
  preserve_clipboard: boolean;
  server_formatting_enabled: boolean;
  server_format_backend: string;
  server_format_style_prompt: string;
  server_format_intensity: number;
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

type View = "history" | "transcription" | "vocabulary" | "claude" | "preferences";

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
  const [useLlmEnhancement, setUseLlmEnhancement] = useState(false);
  const [claudeModel, setClaudeModel] = useState<ClaudeModel>("haiku");
  const [claudeAvailable, setClaudeAvailable] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [shortcut, setShortcut] = useState("Ctrl+Space");
  const [cancelShortcut, setCancelShortcut] = useState("Ctrl+F1");
  const [gpus, setGpus] = useState<GpuInfo[]>([]);
  const [currentGpuVendor, setCurrentGpuVendor] = useState<GpuVendor>("cpu");
  const [overlaySize, setOverlaySize] = useState<OverlaySize>("medium");
  const [useScreenshotForCorrection, setUseScreenshotForCorrection] = useState(false);
  const [pasteScreenshotPath, setPasteScreenshotPath] = useState(false);
  const [screenshotMode, setScreenshotMode] = useState<ScreenshotMode>("primary_only");
  const [vocabulary, setVocabulary] = useState<string[]>([]);
  const [transcriptionMode, setTranscriptionMode] = useState<TranscriptionMode>("local");
  const [serverUrl, setServerUrl] = useState("http://localhost:8000");
  const [serverFallback, setServerFallback] = useState(true);
  const [serverTimeout, setServerTimeout] = useState(30000);
  const [serverToken, setServerToken] = useState<string | null>(null);
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [startMinimized, setStartMinimized] = useState(false);
  const [pauseMediaOnRecord, setPauseMediaOnRecord] = useState(false);
  const [preserveClipboard, setPreserveClipboard] = useState(false);
  const [serverFormattingEnabled, setServerFormattingEnabled] = useState(false);
  const [serverFormatBackend, setServerFormatBackend] = useState("goblin");
  const [serverFormatStylePrompt, setServerFormatStylePrompt] = useState("grammatical");
  const [serverFormatIntensity, setServerFormatIntensity] = useState(3);

  // Refs to avoid re-registering listeners
  const currentModelRef = useRef<string | null>(null);
  const useLlmEnhancementRef = useRef(false);
  const hasInitialized = useRef(false);

  // Keep refs in sync with state
  useEffect(() => {
    currentModelRef.current = currentModel;
  }, [currentModel]);

  useEffect(() => {
    useLlmEnhancementRef.current = useLlmEnhancement;
  }, [useLlmEnhancement]);

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
    checkClaudeAvailable();
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
        enhanced: useLlmEnhancementRef.current,
      };
      setTranscriptions((prev) => {
        const updated = [newTranscription, ...prev];
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
    setUseLlmEnhancement(savedSettings.use_llm_enhancement);
    setClaudeModel(savedSettings.claude_model || "haiku");
    setOverlaySize(savedSettings.overlay_size || "medium");
    setUseScreenshotForCorrection(savedSettings.use_screenshot_for_correction || false);
    setPasteScreenshotPath(savedSettings.paste_screenshot_path || false);
    setScreenshotMode(savedSettings.screenshot_mode || "primary_only");
    setVocabulary(savedSettings.vocabulary || []);
    setTranscriptionMode(savedSettings.transcription_mode || "local");
    setServerUrl(savedSettings.server_url || "http://localhost:8000");
    setServerFallback(savedSettings.server_fallback !== false); // Default to true
    setServerTimeout(savedSettings.server_timeout || 30000);
    setServerToken(savedSettings.server_token || null);
    setPauseMediaOnRecord(savedSettings.pause_media_on_record || false);
    setPreserveClipboard(savedSettings.preserve_clipboard || false);
    setServerFormattingEnabled(savedSettings.server_formatting_enabled || false);
    setServerFormatBackend(savedSettings.server_format_backend || "goblin");
    setServerFormatStylePrompt(savedSettings.server_format_style_prompt || "grammatical");
    setServerFormatIntensity(savedSettings.server_format_intensity || 3);

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

  async function checkClaudeAvailable() {
    const cliAvailable = await invoke<boolean>("check_claude_available");
    setClaudeAvailable(cliAvailable);
  }

  const navItems = [
    { id: "history" as View, icon: History, label: "Historique" },
    { id: "transcription" as View, icon: Mic, label: "Transcription" },
    { id: "vocabulary" as View, icon: BookText, label: "Vocabulaire" },
    { id: "claude" as View, icon: Sparkles, label: "Enhancement" },
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
        <div className="w-[72px] border-r border-[oklch(0.22_0.015_260)] bg-[oklch(0.12_0.01_260)] flex flex-col items-center py-5 gap-2 shrink-0">
          {/* Nav items */}
          {navItems.map((item, index) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={cn(
                "nav-indicator w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 relative group press-effect",
                currentView === item.id
                  ? "active bg-[oklch(0.22_0.02_260)] text-[var(--color-active)] shadow-[inset_0_1px_0_oklch(1_0_0/0.05)]"
                  : "hover:bg-[oklch(0.18_0.015_260)] text-muted-foreground hover:text-foreground"
              )}
              style={{ animationDelay: `${index * 0.05}s` }}
              title={item.label}
            >
              <item.icon className="h-5 w-5" strokeWidth={currentView === item.id ? 2 : 1.5} />
              {/* Tooltip */}
              <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-popover text-popover-foreground text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-150 whitespace-nowrap pointer-events-none z-50 border border-[oklch(0.30_0.015_260)] shadow-lg tooltip-enter translate-x-1 group-hover:translate-x-0">
                {item.label}
              </span>
            </button>
          ))}

          {/* Status indicator at bottom */}
          <div className="mt-auto flex flex-col items-center gap-2">
            <div
              className={cn(
                "h-2.5 w-2.5 rounded-full transition-all duration-300",
                currentModel
                  ? "bg-[var(--color-success)] shadow-[0_0_8px_oklch(0.70_0.17_145/0.5)]"
                  : "bg-[var(--color-warning)] shadow-[0_0_6px_oklch(0.75_0.15_85/0.4)]"
              )}
              title={currentModel ? `Modele: ${currentModel}` : "Aucun modele charge"}
            />
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
            serverToken={serverToken}
            onServerTokenChange={async (token) => {
              setServerToken(token);
              await invoke("set_server_token", { token });
            }}
            serverFormattingEnabled={serverFormattingEnabled}
            onServerFormattingEnabledChange={async (enabled) => {
              setServerFormattingEnabled(enabled);
              await invoke("set_server_formatting_enabled", { enabled });
            }}
            serverFormatBackend={serverFormatBackend}
            onServerFormatBackendChange={async (backend) => {
              setServerFormatBackend(backend);
              await invoke("set_server_format_backend", { backend });
            }}
            serverFormatStylePrompt={serverFormatStylePrompt}
            onServerFormatStylePromptChange={async (prompt) => {
              setServerFormatStylePrompt(prompt);
              await invoke("set_server_format_style_prompt", { prompt });
            }}
            serverFormatIntensity={serverFormatIntensity}
            onServerFormatIntensityChange={async (intensity) => {
              setServerFormatIntensity(intensity);
              await invoke("set_server_format_intensity", { intensity });
            }}
          />
        )}
        {currentView === "vocabulary" && (
          <VocabularyView
            vocabulary={vocabulary}
            onVocabularyChange={setVocabulary}
          />
        )}
        {currentView === "claude" && (
          <ClaudeView
            useLlmEnhancement={useLlmEnhancement}
            claudeAvailable={claudeAvailable}
            onLlmEnhancementChange={async (enabled) => {
              setUseLlmEnhancement(enabled);
              await invoke("set_llm_enhancement", { enabled });
            }}
            claudeModel={claudeModel}
            onClaudeModelChange={async (model) => {
              setClaudeModel(model);
              await invoke("set_claude_model", { model });
            }}
            useScreenshotForCorrection={useScreenshotForCorrection}
            onScreenshotForCorrectionChange={async (enabled) => {
              setUseScreenshotForCorrection(enabled);
              await invoke("set_screenshot_for_correction", { enabled });
            }}
            pasteScreenshotPath={pasteScreenshotPath}
            onPasteScreenshotPathChange={async (enabled) => {
              setPasteScreenshotPath(enabled);
              await invoke("set_paste_screenshot_path", { enabled });
            }}
            screenshotMode={screenshotMode}
            onScreenshotModeChange={async (mode) => {
              setScreenshotMode(mode);
              await invoke("set_screenshot_mode", { mode });
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
