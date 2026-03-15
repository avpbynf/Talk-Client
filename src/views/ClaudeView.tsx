import { ClaudeModel, ScreenshotMode } from "@/App";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Monitor, Link, Info, Check, Zap, Brain, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClaudeViewProps {
  useLlmEnhancement: boolean;
  claudeAvailable: boolean;
  onLlmEnhancementChange: (enabled: boolean) => void;
  claudeModel: ClaudeModel;
  onClaudeModelChange: (model: ClaudeModel) => void;
  useScreenshotForCorrection: boolean;
  onScreenshotForCorrectionChange: (enabled: boolean) => void;
  pasteScreenshotPath: boolean;
  onPasteScreenshotPathChange: (enabled: boolean) => void;
  screenshotMode: ScreenshotMode;
  onScreenshotModeChange: (mode: ScreenshotMode) => void;
}

const claudeModels: { id: ClaudeModel; name: string; description: string; icon: typeof Zap }[] = [
  { id: "haiku", name: "Haiku", description: "Rapide et economique", icon: Zap },
  { id: "sonnet", name: "Sonnet", description: "Equilibre qualite/vitesse", icon: Brain },
  { id: "opus", name: "Opus", description: "Meilleure qualite", icon: Crown },
];

const screenshotModes: { id: ScreenshotMode; name: string; description: string }[] = [
  { id: "primary_only", name: "Ecran principal", description: "Capture uniquement l'ecran principal" },
  { id: "all_screens", name: "Tous les ecrans", description: "Capture tous les moniteurs" },
];

export default function ClaudeView({
  useLlmEnhancement,
  claudeAvailable,
  onLlmEnhancementChange,
  claudeModel,
  onClaudeModelChange,
  useScreenshotForCorrection,
  onScreenshotForCorrectionChange,
  pasteScreenshotPath,
  onPasteScreenshotPathChange,
  screenshotMode,
  onScreenshotModeChange,
}: ClaudeViewProps) {
  const anyScreenshotEnabled = useScreenshotForCorrection || pasteScreenshotPath;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-[oklch(0.22_0.015_260)] shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Enhancement</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Correction des transcriptions et contexte visuel
            </p>
          </div>
          {/* Status badge */}
          <div className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2",
            claudeAvailable
              ? "bg-[var(--color-success)]/15 text-[var(--color-success)] border border-[var(--color-success)]/30"
              : "bg-[var(--color-warning)]/15 text-[var(--color-warning)] border border-[var(--color-warning)]/30"
          )}>
            <div className={cn(
              "h-2 w-2 rounded-full",
              claudeAvailable ? "bg-[var(--color-success)]" : "bg-[var(--color-warning)]"
            )} />
            {claudeAvailable ? "Claude disponible" : "Claude non detecte"}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Warning if Claude not available */}
            {!claudeAvailable && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/20">
                <Info className="h-5 w-5 text-[var(--color-warning)] mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-[var(--color-warning)]">Claude Code non detecte</p>
                  <p className="text-sm text-[var(--color-warning)]/70 mt-1">
                    Installez Claude Code pour activer l'amelioration des transcriptions.
                  </p>
                </div>
              </div>
            )}

            {/* Claude Enhancement Section */}
            <div className="p-5 rounded-xl border border-[oklch(0.25_0.015_260)] bg-[oklch(0.15_0.01_260)] space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                <Sparkles className="h-4 w-4" />
                Claude Enhancement
              </div>

              {/* Main toggle */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <label className="font-medium text-base">Activer Claude</label>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Ameliore et corrige automatiquement les transcriptions avec l'IA
                  </p>
                </div>
                <Switch
                  checked={useLlmEnhancement}
                  onCheckedChange={onLlmEnhancementChange}
                  disabled={!claudeAvailable}
                  className="shrink-0 mt-1"
                />
              </div>

              {/* Model Selection */}
              {useLlmEnhancement && claudeAvailable && (
                <div className="space-y-3 pt-4 border-t border-[oklch(0.22_0.015_260)]">
                  <label className="text-sm font-medium">Modele</label>
                  <div className="space-y-2">
                    {claudeModels.map((model) => {
                      const Icon = model.icon;
                      return (
                        <button
                          key={model.id}
                          onClick={() => onClaudeModelChange(model.id)}
                          className={cn(
                            "w-full p-4 rounded-xl border text-left transition-all duration-200 flex items-center gap-4",
                            claudeModel === model.id
                              ? "border-[var(--color-active)] bg-[var(--color-active)]/10 card-selected"
                              : "border-[oklch(0.25_0.015_260)] bg-[oklch(0.12_0.01_260)] card-interactive"
                          )}
                        >
                          <div className={cn(
                            "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                            claudeModel === model.id
                              ? "bg-[var(--color-active)]/20 text-[var(--color-active)]"
                              : "bg-[oklch(0.20_0.015_260)] text-muted-foreground"
                          )}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{model.name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {model.description}
                            </div>
                          </div>
                          {claudeModel === model.id && (
                            <Check className="h-5 w-5 text-[var(--color-active)] shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Screenshot Options Section */}
            <div className="p-5 rounded-xl border border-[oklch(0.25_0.015_260)] bg-[oklch(0.15_0.01_260)] space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                <Monitor className="h-4 w-4" />
                Contexte Visuel
              </div>

              {/* Correction contextuelle */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                    <Monitor className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="font-medium">Correction contextuelle</label>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Envoie la capture a Claude pour corriger avec le contexte visuel
                    </p>
                  </div>
                </div>
                <Switch
                  checked={useScreenshotForCorrection}
                  onCheckedChange={onScreenshotForCorrectionChange}
                  disabled={!claudeAvailable || !useLlmEnhancement}
                  className="shrink-0 mt-1"
                />
              </div>

              {/* Coller le chemin */}
              <div className="flex items-start justify-between gap-4 pt-4 border-t border-[oklch(0.22_0.015_260)]">
                <div className="flex gap-3">
                  <div className="h-10 w-10 rounded-lg bg-[var(--color-success)]/15 flex items-center justify-center shrink-0">
                    <Link className="h-5 w-5 text-[var(--color-success)]" />
                  </div>
                  <div className="space-y-1">
                    <label className="font-medium">Coller le chemin</label>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Ajoute le chemin de la capture avec le texte
                    </p>
                  </div>
                </div>
                <Switch
                  checked={pasteScreenshotPath}
                  onCheckedChange={onPasteScreenshotPathChange}
                  className="shrink-0 mt-1"
                />
              </div>

              {/* Screenshot Mode */}
              {anyScreenshotEnabled && (
                <div className="space-y-3 pt-4 border-t border-[oklch(0.22_0.015_260)]">
                  <label className="text-sm font-medium">Ecrans a capturer</label>
                  <div className="grid grid-cols-2 gap-3">
                    {screenshotModes.map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => onScreenshotModeChange(mode.id)}
                        className={cn(
                          "p-4 rounded-xl border text-left transition-all duration-200",
                          screenshotMode === mode.id
                            ? "border-blue-500 bg-blue-500/10"
                            : "border-[oklch(0.25_0.015_260)] bg-[oklch(0.12_0.01_260)] card-interactive"
                        )}
                      >
                        <div className="font-medium text-sm">{mode.name}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {mode.description}
                        </div>
                        {screenshotMode === mode.id && (
                          <Check className="h-4 w-4 text-blue-500 mt-2" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Info box */}
            <div className="p-4 rounded-xl bg-[var(--color-active)]/10 border border-[var(--color-active)]/20">
              <div className="flex items-start gap-3">
                <Info className="h-4 w-4 text-[var(--color-active)] mt-0.5 shrink-0" />
                <div className="text-xs text-[var(--color-active)]/80 space-y-1">
                  {useScreenshotForCorrection && useLlmEnhancement && (
                    <p><strong>Correction contextuelle:</strong> L'image aide Claude a corriger les termes techniques visibles a l'ecran.</p>
                  )}
                  {pasteScreenshotPath && (
                    <p><strong>Chemin colle:</strong> Utile pour referencer l'image dans Claude Code.</p>
                  )}
                  {!useScreenshotForCorrection && !pasteScreenshotPath && (
                    <p>Activez une option pour capturer l'ecran pendant l'enregistrement.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
