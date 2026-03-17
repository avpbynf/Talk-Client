import { useEffect, useState, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Mic, Loader2, Brain, Server } from "lucide-react";

type ProcessingState = "idle" | "recording" | "transcribing" | "streaming" | "server_transcribing";
type OverlaySize = "small" | "medium" | "large";

function OverlayPage() {
  const [state, setState] = useState<ProcessingState>("idle");
  const [progress, setProgress] = useState(0);
  const [size, setSize] = useState<OverlaySize>("medium");
  const [spectrum, setSpectrum] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0]);
  const saveTimeoutRef = useRef<number | null>(null);

  // Load overlay size on mount and listen for resize
  useEffect(() => {
    invoke<OverlaySize>("get_overlay_size").then(setSize);

    // Update size when window is resized (triggered by settings change)
    const currentWindow = getCurrentWindow();
    const unlistenResize = currentWindow.onResized(() => {
      invoke<OverlaySize>("get_overlay_size").then(setSize);
    });

    return () => {
      unlistenResize.then((f) => f());
    };
  }, []);

  useEffect(() => {
    const unlistenStarted = listen("recording-started", () => {
      setState("recording");
      setProgress(0);
    });

    const unlistenProcessing = listen<string>("processing-state", (event) => {
      setState(event.payload as ProcessingState);
      if (event.payload !== "transcribing") {
        setProgress(0);
      }
    });

    const unlistenProgress = listen<number>("transcription-progress", (event) => {
      setProgress(event.payload);
    });

    const unlistenCancelled = listen("recording-cancelled", () => {
      setState("idle");
    });

    const unlistenSpectrum = listen<number[]>("audio-spectrum", (event) => {
      setSpectrum(event.payload);
    });

    // Listen for window move to save position
    const currentWindow = getCurrentWindow();
    const unlistenMove = currentWindow.onMoved(({ payload: position }) => {
      // Debounce saving to avoid too many writes
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = window.setTimeout(() => {
        invoke("save_overlay_position", { x: position.x, y: position.y });
      }, 300);
    });

    return () => {
      unlistenStarted.then((f) => f());
      unlistenProcessing.then((f) => f());
      unlistenProgress.then((f) => f());
      unlistenCancelled.then((f) => f());
      unlistenSpectrum.then((f) => f());
      unlistenMove.then((f) => f());
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  if (state === "idle") {
    return null;
  }

  const isSmall = size === "small";

  const renderContent = () => {
    switch (state) {
      case "recording": {
        const numBars = isSmall ? 5 : 8;
        const displaySpectrum = spectrum.slice(0, numBars);
        return (
          <>
            <div className="relative">
              <Mic className={`${isSmall ? "h-4 w-4" : "h-5 w-5"} text-recording`} />
              <span className="absolute -top-1 -right-1 h-2 w-2 bg-recording rounded-full animate-pulse" />
            </div>
            <div className="flex items-center gap-0.5 h-6">
              {displaySpectrum.map((level, i) => (
                <div
                  key={i}
                  className="w-1 bg-recording rounded-full transition-all duration-50"
                  style={{
                    height: `${Math.max(3, 3 + level * 21)}px`,
                  }}
                />
              ))}
            </div>
            {!isSmall && <span className="text-sm font-medium text-foreground">Écoute...</span>}
          </>
        );
      }

      case "transcribing":
        return (
          <>
            <Brain className={`${isSmall ? "h-4 w-4" : "h-5 w-5"} text-server`} />
            {progress === 0 ? (
              <>
                <Loader2 className="h-4 w-4 text-server animate-spin" />
                {!isSmall && <span className="text-sm font-medium text-foreground">Analyse...</span>}
              </>
            ) : (
              <>
                <div className={`${isSmall ? "w-12" : "w-20"} h-1.5 bg-muted rounded-full overflow-hidden`}>
                  <div
                    className="h-full bg-server transition-all duration-150"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {!isSmall && (
                  <span className="text-sm font-medium text-foreground tabular-nums w-10">
                    {progress}%
                  </span>
                )}
              </>
            )}
          </>
        );

      case "streaming":
      case "server_transcribing":
        return (
          <>
            <Server className={`${isSmall ? "h-4 w-4" : "h-5 w-5"} text-server`} />
            <Loader2 className="h-4 w-4 text-server animate-spin" />
            {!isSmall && <span className="text-sm font-medium text-foreground">Transcription...</span>}
          </>
        );

    }
  };

  const handleMouseDown = async () => {
    try {
      await getCurrentWindow().startDragging();
    } catch (e) {
      console.error("Failed to start dragging:", e);
    }
  };

  return (
    <div
      className="h-screen w-screen bg-background/95 backdrop-blur-sm px-4 py-3 flex items-center justify-center gap-3 select-none cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
    >
      {renderContent()}
    </div>
  );
}

export default OverlayPage;
