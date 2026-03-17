import { Activity, AlertCircle, ArrowDownToLine, Check, Globe, Loader2, Shield, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { EngineModeCard } from "@/components/EngineModeCard";
import type { EngineMode, ServerStatus } from "./TranscriptionView";

interface EngineTabProps {
  engineMode: EngineMode;
  onEngineModeChange: (mode: EngineMode) => void;
  currentModel: string | null;
  serverStatus: ServerStatus;
}

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

export function EngineTab({
  engineMode,
  onEngineModeChange,
  currentModel,
  serverStatus,
}: EngineTabProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground mb-6">
        Choisissez comment la transcription sera effectuee.
      </p>

      <div className="space-y-3">
        {/* Local Mode */}
        <EngineModeCard
          selected={engineMode === "local"}
          icon={<ArrowDownToLine className="h-6 w-6" />}
          title="Local uniquement"
          description="Whisper tourne sur votre machine. Aucune donnee envoyee."
          accentColor="var(--color-active)"
          onClick={() => onEngineModeChange("local")}
        >
          {currentModel ? (
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-active)]">
              <Activity className="h-3 w-3" />
              <span>Modele actif : {currentModel}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-warning)]">
              <AlertCircle className="h-3 w-3" />
              <span>Aucun modele charge</span>
            </div>
          )}
        </EngineModeCard>

        {/* Server Mode */}
        <EngineModeCard
          selected={engineMode === "server"}
          icon={<Globe className="h-6 w-6" />}
          title="Serveur uniquement"
          description="Transcription via serveur distant avec streaming temps reel."
          accentColor="var(--color-server)"
          onClick={() => onEngineModeChange("server")}
        >
          <div className="flex items-center gap-1.5">
            {statusIcon(serverStatus, "sm")}
            <span className={cn(
              "text-xs",
              serverStatus === "online" ? "text-[var(--color-success)]" :
              serverStatus === "offline" ? "text-[var(--color-destructive)]" :
              "text-muted-foreground"
            )}>
              {statusText(serverStatus)}
            </span>
          </div>
        </EngineModeCard>

        {/* Server + Fallback Mode */}
        <EngineModeCard
          selected={engineMode === "server_fallback"}
          icon={<Shield className="h-6 w-6" />}
          title="Serveur + Fallback local"
          description="Serveur en priorite, bascule en local si indisponible."
          accentColor="var(--color-hybrid)"
          onClick={() => onEngineModeChange("server_fallback")}
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              {statusIcon(serverStatus, "sm")}
              <span className={cn(
                "text-xs",
                serverStatus === "online" ? "text-[var(--color-success)]" :
                serverStatus === "offline" ? "text-[var(--color-destructive)]" :
                "text-muted-foreground"
              )}>
                Serveur: {statusText(serverStatus)}
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
        </EngineModeCard>
      </div>
    </div>
  );
}
