import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, Copy, X } from "lucide-react";

interface TitlebarProps {
  title?: string;
}

export function Titlebar({ title = "T4lk" }: TitlebarProps) {
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
      className="h-9 flex items-center justify-between bg-surface-deep border-b border-border-subtle select-none shrink-0"
    >
      {/* Left section - Title */}
      <div className="flex items-center gap-2 pl-3" data-tauri-drag-region>
        <span className="text-xs font-medium text-muted select-none" data-tauri-drag-region>
          {title}
        </span>
      </div>

      {/* Right section - Window controls */}
      <div className="flex items-center h-full">
        <button
          onClick={handleMinimize}
          className="h-full w-11 flex items-center justify-center text-muted-foreground hover:bg-surface-active hover:text-foreground transition-colors duration-150"
          aria-label="Minimize"
        >
          <Minus className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
        <button
          onClick={handleMaximize}
          className="h-full w-11 flex items-center justify-center text-muted-foreground hover:bg-surface-active hover:text-foreground transition-colors duration-150"
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
          className="h-full w-11 flex items-center justify-center text-muted-foreground hover:bg-destructive hover:text-white transition-colors duration-150"
          aria-label="Close"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
