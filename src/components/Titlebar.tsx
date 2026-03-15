import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, Copy, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TitlebarProps {
  title?: string;
  isRecording?: boolean;
}

export function Titlebar({ title = "Whisper Flow", isRecording = false }: TitlebarProps) {
  const appWindow = getCurrentWindow();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const checkMaximized = async () => {
      setIsMaximized(await appWindow.isMaximized());
    };
    checkMaximized();

    const unsubscribe = appWindow.onResized(checkMaximized);
    return () => {
      unsubscribe.then((fn) => fn());
    };
  }, [appWindow]);

  const handleMinimize = () => appWindow.minimize();
  const handleMaximize = async () => {
    await appWindow.toggleMaximize();
    setIsMaximized(await appWindow.isMaximized());
  };
  const handleClose = () => appWindow.close();

  return (
    <div
      data-tauri-drag-region
      onDoubleClick={handleMaximize}
      className="h-9 flex items-center justify-between bg-[oklch(0.11_0.01_260)] border-b border-[oklch(0.22_0.01_260)] select-none shrink-0"
    >
      {/* Left section - Logo and title */}
      <div data-tauri-drag-region className="flex items-center gap-3 pl-3">
        {/* Recording indicator with glow effect */}
        <div className="relative">
          <div
            className={cn(
              "h-2.5 w-2.5 rounded-full transition-all duration-300",
              isRecording
                ? "bg-[var(--color-recording)] recording-glow"
                : "bg-[oklch(0.35_0.01_260)]"
            )}
          />
          {isRecording && (
            <>
              <div className="recording-ring" />
              <div className="absolute inset-0 rounded-full bg-[var(--color-recording)] blur-sm opacity-60" />
            </>
          )}
        </div>

        <span
          data-tauri-drag-region
          className={cn(
            "text-xs font-medium tracking-wide transition-colors duration-300",
            isRecording ? "text-[var(--color-recording)]" : "text-muted-foreground"
          )}
        >
          {isRecording ? "Recording..." : title}
        </span>
      </div>

      {/* Right section - Window controls */}
      <div className="flex items-center h-full">
        <button
          onClick={handleMinimize}
          className="h-full w-11 flex items-center justify-center text-muted-foreground hover:bg-[oklch(0.20_0.01_260)] hover:text-foreground transition-colors duration-150"
          aria-label="Minimize"
        >
          <Minus className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
        <button
          onClick={handleMaximize}
          className="h-full w-11 flex items-center justify-center text-muted-foreground hover:bg-[oklch(0.20_0.01_260)] hover:text-foreground transition-colors duration-150"
          aria-label={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? (
            <Copy className="h-3 w-3" strokeWidth={1.5} />
          ) : (
            <Square className="h-3 w-3" strokeWidth={1.5} />
          )}
        </button>
        <button
          onClick={handleClose}
          className="h-full w-11 flex items-center justify-center text-muted-foreground hover:bg-[oklch(0.55_0.20_25)] hover:text-white transition-colors duration-150"
          aria-label="Close"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
