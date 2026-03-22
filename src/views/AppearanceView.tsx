import type { OverlayThemeId } from "@/lib/overlay-themes";
import { ScrollArea } from "@/components/ui/scroll-area";
import OverlaySection from "./preferences/OverlaySection";

interface AppearanceViewProps {
  overlayTheme: OverlayThemeId;
  onOverlayThemeChange: (theme: OverlayThemeId) => void;
}

export default function AppearanceView({
  overlayTheme,
  onOverlayThemeChange,
}: AppearanceViewProps) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Page title */}
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Apparence</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Personnalisation visuelle
              </p>
            </div>

            {/* Separator */}
            <div className="h-px bg-border-subtle" />

            <OverlaySection
              overlayTheme={overlayTheme}
              onOverlayThemeChange={onOverlayThemeChange}
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
