import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TranscriptionMode } from "@/App";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Server, Wifi, WifiOff, AlertCircle, Check, Loader2, RefreshCw, Clock, ArrowDownToLine, Key, Eye, EyeOff } from "lucide-react";

interface ServerViewProps {
  transcriptionMode: TranscriptionMode;
  onTranscriptionModeChange: (mode: TranscriptionMode) => void;
  serverUrl: string;
  onServerUrlChange: (url: string) => void;
  serverFallback: boolean;
  onServerFallbackChange: (enabled: boolean) => void;
  serverTimeout: number;
  onServerTimeoutChange: (timeout: number) => void;
  serverToken: string | null;
  onServerTokenChange: (token: string | null) => void;
}

type ServerStatus = "unknown" | "checking" | "online" | "offline";

export default function ServerView({
  transcriptionMode,
  onTranscriptionModeChange,
  serverUrl,
  onServerUrlChange,
  serverFallback,
  onServerFallbackChange,
  serverTimeout,
  onServerTimeoutChange,
  serverToken,
  onServerTokenChange,
}: ServerViewProps) {
  const [serverStatus, setServerStatus] = useState<ServerStatus>("unknown");
  const [urlInput, setUrlInput] = useState(serverUrl);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState(serverToken || "");
  const [showToken, setShowToken] = useState(false);

  const checkServerHealth = async () => {
    setServerStatus("checking");
    try {
      const isHealthy = await invoke<boolean>("check_server_health");
      setServerStatus(isHealthy ? "online" : "offline");
    } catch (error) {
      console.error("Health check failed:", error);
      setServerStatus("offline");
    }
  };

  const saveServerUrl = () => {
    // Basic URL validation
    try {
      new URL(urlInput);
      setUrlError(null);
      onServerUrlChange(urlInput);
      setServerStatus("unknown");
    } catch {
      setUrlError("URL invalide");
    }
  };

  const handleUrlBlur = () => {
    if (urlInput !== serverUrl) {
      saveServerUrl();
    }
  };

  const handleUrlKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      saveServerUrl();
    }
  };

  const isServerMode = transcriptionMode === "server";

  const statusIcon = () => {
    switch (serverStatus) {
      case "checking":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "online":
        return <Wifi className="h-4 w-4 text-green-500" />;
      case "offline":
        return <WifiOff className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const statusText = () => {
    switch (serverStatus) {
      case "checking":
        return "Verification...";
      case "online":
        return "Serveur connecte";
      case "offline":
        return "Serveur indisponible";
      default:
        return "Non verifie";
    }
  };

  const timeoutOptions = [
    { value: 10000, label: "10s" },
    { value: 30000, label: "30s" },
    { value: 60000, label: "1min" },
    { value: 120000, label: "2min" },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-[oklch(0.22_0.015_260)] shrink-0">
        <h1 className="text-xl font-semibold tracking-tight">Transcription Serveur</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Utiliser un serveur distant pour la transcription
        </p>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Mode Selection */}
            <div className="p-5 rounded-xl border border-[oklch(0.25_0.015_260)] bg-[oklch(0.15_0.01_260)] space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                <Server className="h-4 w-4" />
                Mode de transcription
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => onTranscriptionModeChange("local")}
                  className={`p-4 rounded-xl border text-left transition-all duration-200 ${
                    transcriptionMode === "local"
                      ? "border-[var(--color-active)] bg-[var(--color-active)]/10"
                      : "border-[oklch(0.25_0.015_260)] bg-[oklch(0.12_0.01_260)] card-interactive"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${transcriptionMode === "local" ? "bg-[var(--color-active)]/20 text-[var(--color-active)]" : "bg-[oklch(0.20_0.015_260)] text-muted-foreground"}`}>
                      <ArrowDownToLine className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-medium">Local</div>
                      <div className="text-xs text-muted-foreground">Whisper sur votre machine</div>
                    </div>
                  </div>
                  {transcriptionMode === "local" && (
                    <Check className="h-4 w-4 text-[var(--color-active)] mt-2" />
                  )}
                </button>

                <button
                  onClick={() => onTranscriptionModeChange("server")}
                  className={`p-4 rounded-xl border text-left transition-all duration-200 ${
                    transcriptionMode === "server"
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-[oklch(0.25_0.015_260)] bg-[oklch(0.12_0.01_260)] card-interactive"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${transcriptionMode === "server" ? "bg-blue-500/20 text-blue-500" : "bg-[oklch(0.20_0.015_260)] text-muted-foreground"}`}>
                      <Server className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-medium">Serveur</div>
                      <div className="text-xs text-muted-foreground">Streaming temps reel</div>
                    </div>
                  </div>
                  {transcriptionMode === "server" && (
                    <Check className="h-4 w-4 text-blue-500 mt-2" />
                  )}
                </button>
              </div>
            </div>

            {/* Server Configuration */}
            {isServerMode && (
              <>
                {/* Server URL */}
                <div className="p-5 rounded-xl border border-[oklch(0.25_0.015_260)] bg-[oklch(0.15_0.01_260)] space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    <Wifi className="h-4 w-4" />
                    Configuration serveur
                  </div>

                  {/* URL Input */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">URL du serveur</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        onBlur={handleUrlBlur}
                        onKeyDown={handleUrlKeyDown}
                        placeholder="http://localhost:8000"
                        className="flex-1 px-3 py-2.5 text-sm rounded-lg border border-[oklch(0.25_0.015_260)] bg-[oklch(0.12_0.01_260)] focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                      />
                      <button
                        onClick={checkServerHealth}
                        disabled={serverStatus === "checking"}
                        className="px-3 py-2 rounded-lg border border-[oklch(0.28_0.015_260)] hover:bg-[oklch(0.20_0.015_260)] disabled:opacity-50 transition-colors"
                        title="Tester la connexion"
                      >
                        <RefreshCw className={`h-4 w-4 ${serverStatus === "checking" ? "animate-spin" : ""}`} />
                      </button>
                    </div>
                    {urlError && (
                      <p className="text-xs text-[var(--color-destructive)]">{urlError}</p>
                    )}
                  </div>

                  {/* Token Input */}
                  <div className="space-y-2 pt-4 border-t border-[oklch(0.22_0.015_260)]">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Key className="h-4 w-4 text-blue-500" />
                      Token d'authentification
                    </label>
                    <div className="relative">
                      <input
                        type={showToken ? "text" : "password"}
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        onBlur={() => {
                          const newToken = tokenInput.trim() || null;
                          if (newToken !== serverToken) {
                            onServerTokenChange(newToken);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const newToken = tokenInput.trim() || null;
                            onServerTokenChange(newToken);
                          }
                        }}
                        placeholder="Bearer token (optionnel)"
                        className="w-full px-3 py-2.5 pr-10 text-sm rounded-lg border border-[oklch(0.25_0.015_260)] bg-[oklch(0.12_0.01_260)] focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Token Bearer pour l'authentification au serveur
                    </p>
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[oklch(0.12_0.01_260)]">
                    <div className="flex items-center gap-2">
                      {statusIcon()}
                      <span className="text-sm">{statusText()}</span>
                    </div>
                    {serverStatus === "online" && (
                      <span className="text-xs text-[var(--color-success)]">Pret</span>
                    )}
                  </div>
                </div>

                {/* Timeout */}
                <div className="p-5 rounded-xl border border-[oklch(0.25_0.015_260)] bg-[oklch(0.15_0.01_260)] space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <label className="font-medium">Delai maximum</label>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {timeoutOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => onServerTimeoutChange(option.value)}
                        className={`px-3 py-2.5 text-sm font-medium rounded-lg border transition-all duration-200 ${
                          serverTimeout === option.value
                            ? "border-blue-500 bg-blue-500/10 text-blue-500"
                            : "border-[oklch(0.25_0.015_260)] bg-[oklch(0.12_0.01_260)] hover:bg-[oklch(0.18_0.015_260)]"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Temps d'attente maximum avant de considerer le serveur comme indisponible
                  </p>
                </div>

                {/* Fallback */}
                <div className="p-5 rounded-xl border border-[oklch(0.25_0.015_260)] bg-[oklch(0.15_0.01_260)]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-3">
                      <div className="h-10 w-10 rounded-lg bg-[var(--color-active)]/15 flex items-center justify-center shrink-0">
                        <ArrowDownToLine className="h-5 w-5 text-[var(--color-active)]" />
                      </div>
                      <div className="space-y-1">
                        <label className="font-medium">Fallback local</label>
                        <p className="text-sm text-muted-foreground">
                          Utiliser Whisper local si le serveur est indisponible
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={serverFallback}
                      onCheckedChange={onServerFallbackChange}
                      className="shrink-0 mt-1"
                    />
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-start gap-3">
                    <Server className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                    <div className="text-xs text-blue-300/80">
                      <p className="font-medium mb-1 text-blue-300">Streaming SSE</p>
                      <p>
                        Le serveur envoie les segments de transcription en temps reel.
                        Vous voyez le texte apparaitre progressivement dans l'overlay.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Local Mode Info */}
            {!isServerMode && (
              <div className="p-4 rounded-xl bg-[var(--color-active)]/10 border border-[var(--color-active)]/20">
                <div className="flex items-start gap-3">
                  <ArrowDownToLine className="h-4 w-4 text-[var(--color-active)] mt-0.5 shrink-0" />
                  <div className="text-xs text-[var(--color-active)]/80">
                    <p className="font-medium mb-1 text-[var(--color-active)]">Mode local actif</p>
                    <p>
                      La transcription est effectuee localement avec Whisper.
                      Assurez-vous d'avoir telecharge et charge un modele.
                    </p>
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
