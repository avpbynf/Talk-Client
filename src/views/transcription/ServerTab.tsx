import { useState } from "react";
import { Activity, AlertCircle, Check, Clock, Loader2, RefreshCw, Server, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import type { ServerStatus } from "./TranscriptionView";

interface ServerTabProps {
  serverUrl: string;
  serverTimeout: number;
  serverStatus: ServerStatus;
  onServerUrlChange: (url: string) => void;
  onServerTimeoutChange: (timeout: number) => void;
  checkServerHealth: (silent?: boolean) => void;
  serverToken: string;
  onServerTokenChange: (token: string) => void;
  serverFallback: boolean;
  onServerFallbackChange: (value: boolean) => void;
}

const TIMEOUT_OPTIONS = [
  { value: 10000, label: "10s" },
  { value: 30000, label: "30s" },
  { value: 60000, label: "1min" },
  { value: 120000, label: "2min" },
];

function statusIcon(serverStatus: ServerStatus, size: "sm" | "md" = "md") {
  const sizeClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  switch (serverStatus) {
    case "checking":
      return <Loader2 className={cn(sizeClass, "text-server animate-spin")} />;
    case "online":
      return <Check className={cn(sizeClass, "text-[var(--color-success)]")} />;
    case "offline":
      return <WifiOff className={cn(sizeClass, "text-[var(--color-destructive)]")} />;
    default:
      return <AlertCircle className={cn(sizeClass, "text-muted-foreground")} />;
  }
}

function statusText(serverStatus: ServerStatus) {
  switch (serverStatus) {
    case "checking": return "Verification...";
    case "online": return "Connecte";
    case "offline": return "Indisponible";
    default: return "Non teste";
  }
}

export function ServerTab({
  serverUrl,
  serverTimeout,
  serverStatus,
  onServerUrlChange,
  onServerTimeoutChange,
  checkServerHealth,
  serverToken,
  onServerTokenChange,
  serverFallback,
  onServerFallbackChange,
}: ServerTabProps) {
  const [urlInput, setUrlInput] = useState(serverUrl);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState(serverToken || "");

  const saveServerUrl = () => {
    try {
      new URL(urlInput);
      setUrlError(null);
      onServerUrlChange(urlInput);
    } catch {
      setUrlError("URL invalide");
    }
  };

  return (
    <div className="space-y-5">
      {/* Server Connection */}
      <div className="p-5 rounded-xl border border-border-card bg-surface-raised space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-[var(--color-server)]/15 flex items-center justify-center">
            <Server className="h-4 w-4 text-server" />
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
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-border-card bg-surface-inset focus:outline-none focus:ring-2 focus:ring-[var(--color-server)]/30 focus:border-[var(--color-server)] font-mono"
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
                    : "border-border hover:bg-surface-active"
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
              : "bg-surface-inset border border-border-subtle"
          )}>
            {statusIcon(serverStatus)}
            <span className="text-sm">{statusText(serverStatus)}</span>
          </div>

          {/* Token API */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Token API <span className="text-muted text-xs font-normal">(optionnel)</span>
            </label>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              onBlur={() => { if (tokenInput !== serverToken) onServerTokenChange(tokenInput); }}
              placeholder="sk-... ou laisser vide"
              className="w-full px-3 py-2 rounded-lg bg-surface-inset border border-border-card text-sm font-mono input-glow placeholder:text-muted/50"
            />
            <p className="text-xs text-muted">Compatible OpenAI API. Requis pour les services tiers.</p>
          </div>
        </div>
      </div>

      {/* Timeout */}
      <div className="p-5 rounded-xl border border-border-card bg-surface-raised space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-[var(--color-server)]/15 flex items-center justify-center">
            <Clock className="h-4 w-4 text-server" />
          </div>
          <div>
            <h3 className="font-medium text-sm">Timeout</h3>
            <p className="text-xs text-muted-foreground">Delai maximum pour la transcription</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {TIMEOUT_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => onServerTimeoutChange(option.value)}
              className={cn(
                "px-3 py-2 text-sm font-medium rounded-lg border transition-all duration-200",
                serverTimeout === option.value
                  ? "border-[var(--color-server)] bg-[var(--color-server)]/15 text-server"
                  : "border-border-card bg-surface-inset hover:bg-surface-elevated text-muted-foreground"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Fallback local */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-surface-raised border border-border-card">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">Fallback local</p>
          <p className="text-xs text-muted">Utiliser le modele local si le serveur est indisponible</p>
        </div>
        <Switch checked={serverFallback} onCheckedChange={onServerFallbackChange} />
      </div>

      {/* SSE Info */}
      <div className="p-4 rounded-lg bg-[var(--color-server)]/10 border border-[var(--color-server)]/20">
        <div className="flex items-start gap-3">
          <Activity className="h-4 w-4 text-server mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-server">Streaming SSE</p>
            <p className="text-xs text-[var(--color-server)]/70 mt-1">
              Le serveur envoie les segments en temps reel. Le texte apparait progressivement dans l'overlay pendant la transcription.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
