import { Sparkles } from "lucide-react";
import type { OverlaySize } from "@/App";
import { type OverlayThemeId, THEME_IDS, getThemeLabel, getThemePreviewColors } from "@/lib/overlay-themes";
import { cn } from "@/lib/utils";

interface OverlaySectionProps {
  overlayTheme: OverlayThemeId;
  onOverlayThemeChange: (theme: OverlayThemeId) => void;
  overlaySize: OverlaySize;
  onOverlaySizeChange: (size: OverlaySize) => void;
}

/** Mirrors OverlaySize::dimensions() on the Rust side, which does the resizing. */
const SIZES: { id: OverlaySize; label: string; dimensions: string }[] = [
  { id: "small", label: "Petit", dimensions: "160 x 44" },
  { id: "medium", label: "Moyen", dimensions: "220 x 60" },
  { id: "large", label: "Grand", dimensions: "280 x 76" },
];

const optionClasses = (isActive: boolean) =>
  cn(
    "cursor-pointer flex flex-col items-center gap-2 p-3 rounded-lg border transition-all duration-200",
    isActive
      ? "border-[var(--color-active)] bg-[var(--color-active)]/10"
      : "border-border-card bg-surface-deep hover:border-border-hover hover:bg-surface-raised"
  );

export default function OverlaySection({
  overlayTheme,
  onOverlayThemeChange,
  overlaySize,
  onOverlaySizeChange,
}: OverlaySectionProps) {
  return (
    <div className="p-5 rounded-xl border border-border-card bg-surface-raised space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
        <Sparkles className="h-4 w-4" />
        Overlay
      </div>

      <p className="text-sm text-muted-foreground">
        Taille de la fenêtre affichée pendant l'enregistrement.
      </p>

      <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border-subtle">
        {SIZES.map(({ id, label, dimensions }) => {
          const isActive = overlaySize === id;

          return (
            <button key={id} onClick={() => onOverlaySizeChange(id)} className={optionClasses(isActive)}>
              <span className={cn("text-xs font-medium", isActive ? "text-foreground" : "text-muted-foreground")}>
                {label}
              </span>
              <span className="text-[11px] text-muted-foreground tabular-nums">{dimensions}</span>
            </button>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground">
        Thème de couleur de l'effet lumineux pendant l'enregistrement.
      </p>

      <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border-subtle">
        {THEME_IDS.map((id) => {
          const colors = getThemePreviewColors(id);
          const isActive = overlayTheme === id;

          return (
            <button key={id} onClick={() => onOverlayThemeChange(id)} className={optionClasses(isActive)}>
              {/* Color preview, 3 dots */}
              <div className="flex gap-1.5">
                {colors.map((color, i) => (
                  <div
                    key={i}
                    className="w-3 h-3 rounded-full"
                    style={{ background: color }}
                  />
                ))}
              </div>
              <span className={cn("text-xs font-medium", isActive ? "text-foreground" : "text-muted-foreground")}>
                {getThemeLabel(id)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
