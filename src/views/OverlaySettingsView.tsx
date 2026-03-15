import { OverlaySize } from "@/App";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Maximize2, Info, Check } from "lucide-react";

interface OverlaySettingsViewProps {
  overlaySize: OverlaySize;
  onOverlaySizeChange: (size: OverlaySize) => void;
}

const overlaySizes: { id: OverlaySize; name: string; description: string; preview: string }[] = [
  { id: "small", name: "Petit", description: "Compact et discret", preview: "120 x 40" },
  { id: "medium", name: "Moyen", description: "Taille par défaut", preview: "200 x 60" },
  { id: "large", name: "Grand", description: "Plus visible", preview: "280 x 80" },
];

export default function OverlaySettingsView({
  overlaySize,
  onOverlaySizeChange,
}: OverlaySettingsViewProps) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-[oklch(0.22_0.015_260)] shrink-0">
        <h1 className="text-xl font-semibold tracking-tight">Overlay</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Apparence de l'indicateur d'enregistrement
        </p>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Size Selection */}
            <div className="p-5 rounded-xl border border-[oklch(0.25_0.015_260)] bg-[oklch(0.15_0.01_260)] space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                <Maximize2 className="h-4 w-4" />
                Taille de l'overlay
              </div>

              <div className="space-y-2">
                {overlaySizes.map((size) => (
                  <button
                    key={size.id}
                    onClick={() => onOverlaySizeChange(size.id)}
                    className={`w-full p-4 rounded-xl border text-left transition-all duration-200 flex items-center justify-between ${
                      overlaySize === size.id
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-[oklch(0.25_0.015_260)] bg-[oklch(0.12_0.01_260)] card-interactive"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Maximize2 className={`h-5 w-5 ${overlaySize === size.id ? "text-blue-500" : "text-muted-foreground"}`} />
                      <div>
                        <div className="font-medium">{size.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {size.description}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground font-mono">
                        {size.preview}
                      </span>
                      {overlaySize === size.id && (
                        <Check className="h-5 w-5 text-blue-500" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Position Info */}
            <div className="p-5 rounded-xl border border-[oklch(0.25_0.015_260)] bg-[oklch(0.15_0.01_260)]">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <label className="font-medium">Position</label>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Glissez l'overlay pendant l'enregistrement pour changer sa position.
                La position sera sauvegardee automatiquement.
              </p>
            </div>

            {/* Info */}
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-start gap-3">
                <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-300/80">
                  Les changements de taille prennent effet au prochain enregistrement.
                </p>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
