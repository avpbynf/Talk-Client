import { useEffect, useState, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Mic, Brain, Server } from "lucide-react";

type ProcessingState = "idle" | "recording" | "transcribing" | "streaming" | "server_transcribing";
type OverlaySize = "small" | "medium" | "large";

function OverlayPage() {
  const [state, setState] = useState<ProcessingState>("idle");
  const [progress, setProgress] = useState(0);
  const [size, setSize] = useState<OverlaySize>("medium");
  const [spectrum, setSpectrum] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0]);
  const [elapsed, setElapsed] = useState(0);
  const [visible, setVisible] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  // Load overlay size on mount and listen for resize
  useEffect(() => {
    invoke<OverlaySize>("get_overlay_size").then(setSize);

    const currentWindow = getCurrentWindow();
    const unlistenResize = currentWindow.onResized(() => {
      invoke<OverlaySize>("get_overlay_size").then(setSize);
    });

    return () => {
      unlistenResize.then((f) => f());
    };
  }, []);

  // Timer for recording elapsed time
  useEffect(() => {
    if (state === "recording") {
      setElapsed(0);
      timerRef.current = window.setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [state]);

  useEffect(() => {
    const unlistenStarted = listen("recording-started", () => {
      setState("recording");
      setProgress(0);
      setVisible(true);
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
      setVisible(false);
    });

    const unlistenSpectrum = listen<number[]>("audio-spectrum", (event) => {
      setSpectrum(event.payload);
    });

    const currentWindow = getCurrentWindow();
    const unlistenMove = currentWindow.onMoved(({ payload: position }) => {
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

  // Fade out then hide
  useEffect(() => {
    if (state === "idle" && visible) {
      const timeout = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timeout);
    }
  }, [state, visible]);

  if (!visible && state === "idle") {
    return null;
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Average audio level for glow intensity
  const avgLevel = spectrum.reduce((a, b) => a + b, 0) / spectrum.length;
  // Border glow opacity scales with audio level
  const glowOpacity = 0.3 + avgLevel * 0.7;

  const renderContent = () => {
    switch (state) {
      case "recording":
        return (
          <>
            {/* Mic icon */}
            <Mic className="h-4 w-4 text-foreground/70" />

            {/* Spectrum bars */}
            <div className="flex items-center gap-[3px] h-5">
              {spectrum.slice(0, 7).map((level, i) => (
                <div
                  key={i}
                  className="w-[3px] overlay-bar"
                  style={{
                    height: `${Math.max(3, Math.round(3 + level * 17))}px`,
                    background: `oklch(${0.75 + level * 0.15} ${0.01 + level * 0.04} 260)`,
                  }}
                />
              ))}
            </div>

            {/* Elapsed time */}
            <span className="text-xs font-mono font-medium text-foreground/60 tabular-nums tracking-wider">
              {formatTime(elapsed)}
            </span>
          </>
        );

      case "transcribing":
        return (
          <>
            <Brain className="h-4 w-4 text-foreground/70" />
            {progress === 0 ? (
              <div className="flex gap-1 items-center">
                <span className="overlay-dot overlay-dot-neutral" style={{ animationDelay: "0ms" }} />
                <span className="overlay-dot overlay-dot-neutral" style={{ animationDelay: "150ms" }} />
                <span className="overlay-dot overlay-dot-neutral" style={{ animationDelay: "300ms" }} />
              </div>
            ) : (
              <>
                <div className="w-16 h-1 bg-foreground/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-foreground/50 rounded-full transition-all duration-200 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs font-mono font-medium text-foreground/60 tabular-nums">
                  {progress}%
                </span>
              </>
            )}
          </>
        );

      case "streaming":
      case "server_transcribing":
        return (
          <>
            <Server className="h-4 w-4 text-foreground/70" />
            <div className="flex gap-1 items-center">
              <span className="overlay-dot overlay-dot-neutral" style={{ animationDelay: "0ms" }} />
              <span className="overlay-dot overlay-dot-neutral" style={{ animationDelay: "150ms" }} />
              <span className="overlay-dot overlay-dot-neutral" style={{ animationDelay: "300ms" }} />
            </div>
          </>
        );
    }
  };

  const handleMouseDown = async () => {
    try {
      await getCurrentWindow().startDragging();
    } catch {
      // Dragging failed, ignore
    }
  };

  return (
    <div
      className={`h-screen w-screen select-none cursor-grab active:cursor-grabbing ${
        state === "idle" ? "overlay-exit" : "overlay-enter"
      }`}
      onMouseDown={handleMouseDown}
    >
      {/* Rotating gradient border layer */}
      <div
        className="absolute inset-0 overlay-glow-border"
        style={{ opacity: glowOpacity }}
      />

      {/* Content layer */}
      <div className="absolute inset-[1.5px] bg-background rounded-[1px] flex items-center justify-center gap-3 px-4">
        {renderContent()}
      </div>
    </div>
  );
}

export default OverlayPage;
