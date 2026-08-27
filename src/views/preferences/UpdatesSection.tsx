import { ArrowDownToLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Updater } from "@/lib/use-updater";

interface UpdatesSectionProps {
  updater: Updater;
}

function statusLine(updater: Updater): string {
  switch (updater.status) {
    case "checking":
      return "Asking GitHub";
    case "available":
      return `Talk ${updater.availableVersion} is out, and the banner up top installs it`;
    case "downloading":
      return `Downloading, ${updater.progress}%`;
    case "ready":
      return "Installing, the window closes and comes back";
    case "error":
      return updater.error ?? "The check failed";
    case "idle":
      if (!updater.lastCheckedAt) return "Checked at every launch, and every hour after";
      return `Up to date, checked at ${updater.lastCheckedAt.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
  }
}

export default function UpdatesSection({ updater }: UpdatesSectionProps) {
  const busy = updater.status === "checking" || updater.status === "downloading" || updater.status === "ready";

  return (
    <div className="p-5 rounded-xl border border-border-card bg-surface-raised space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
        <ArrowDownToLine className="h-4 w-4" />
        Updates
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <label className="text-sm font-medium">
            {updater.currentVersion ? `Version ${updater.currentVersion}` : "Version"}
          </label>
          <p
            className={`text-sm mt-0.5 ${
              updater.status === "error" ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {statusLine(updater)}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={updater.checkNow} disabled={busy}>
          Check now
        </Button>
      </div>
    </div>
  );
}
