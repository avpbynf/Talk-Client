import { useCallback, useEffect, useRef, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";

/**
 * Talking to GitHub about updates.
 *
 * The feed is `latest.json`, published as an asset of the newest release by the
 * release workflow, and the endpoint in `tauri.conf.json` points at
 * `releases/latest/download`, so it follows along on its own. Nothing installs
 * unless it is signed by the key whose public half is in that same file.
 *
 * A window here is left open for days, so one look at launch would go stale. It
 * looks again every hour.
 */

/** Let the launch settle before the first look: models and devices come first. */
const FIRST_CHECK_DELAY_MS = 10_000;
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

export type UpdaterStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready"
  | "error";

export interface Updater {
  status: UpdaterStatus;
  /** What is running, read from the bundle rather than from package.json. */
  currentVersion: string;
  /** What the feed offers, when it offers something. */
  availableVersion: string | null;
  /** How much of the installer has arrived, while it is arriving. */
  progress: number;
  /** Only ever set by a check the user asked for: see `runCheck`. */
  error: string | null;
  lastCheckedAt: Date | null;
  /** Whether the banner for the offered version has been waved away. */
  dismissed: boolean;
  checkNow: () => void;
  install: () => void;
  dismiss: () => void;
}

export function useUpdater(): Updater {
  const [status, setStatus] = useState<UpdaterStatus>("idle");
  const [currentVersion, setCurrentVersion] = useState("");
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  // The Update owns the download, so it has to outlive the render that announced it.
  const pending = useRef<Update | null>(null);
  // Guards the hourly look against itself, and against the download it started.
  const busy = useRef(false);

  useEffect(() => {
    getVersion()
      .then(setCurrentVersion)
      .catch((e) => console.error("Failed to read the running version:", e));
  }, []);

  const runCheck = useCallback(async (manual: boolean) => {
    if (busy.current) return;
    // An offer already on the table is not asked for again on a timer.
    if (!manual && pending.current) return;

    busy.current = true;
    if (manual) setError(null);
    setStatus("checking");
    try {
      const update = await check();
      setLastCheckedAt(new Date());
      // An Update holds a handle on the Rust side, so the one it replaces is let
      // go of rather than left behind.
      if (pending.current) await pending.current.close();
      pending.current = update;
      setAvailableVersion(update ? update.version : null);
      setStatus(update ? "available" : "idle");
    } catch (e) {
      // A machine that is offline, or a release without a feed, is not news: the
      // hourly look says nothing and tries again later. The button does say so.
      console.error("Update check failed:", e);
      if (manual) {
        setError(String(e));
        setStatus("error");
      } else {
        setStatus("idle");
      }
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    const first = window.setTimeout(() => void runCheck(false), FIRST_CHECK_DELAY_MS);
    const timer = window.setInterval(() => void runCheck(false), CHECK_INTERVAL_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [runCheck]);

  const install = useCallback(async () => {
    const update = pending.current;
    if (!update || busy.current) return;

    busy.current = true;
    setError(null);
    setProgress(0);
    setStatus("downloading");
    try {
      let total = 0;
      let received = 0;
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            total = event.data.contentLength ?? 0;
            break;
          case "Progress":
            received += event.data.chunkLength;
            if (total > 0) {
              setProgress(Math.min(100, Math.round((received / total) * 100)));
            }
            break;
          case "Finished":
            setProgress(100);
            break;
        }
      });

      // On Windows the NSIS installer takes over and closes the application
      // itself, so what follows usually never runs. It is here for the case where
      // the process is still standing once the installer is done.
      setStatus("ready");
      await relaunch();
    } catch (e) {
      console.error("Update install failed:", e);
      setError(String(e));
      setStatus("error");
    } finally {
      busy.current = false;
    }
  }, []);

  return {
    status,
    currentVersion,
    availableVersion,
    progress,
    error,
    lastCheckedAt,
    dismissed: availableVersion !== null && availableVersion === dismissedVersion,
    checkNow: () => void runCheck(true),
    install: () => void install(),
    dismiss: () => setDismissedVersion(availableVersion),
  };
}
