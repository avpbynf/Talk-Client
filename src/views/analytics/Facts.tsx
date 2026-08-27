import { UI_LOCALE } from "@/lib/analytics";
import type { AnalyticsSummary } from "@/lib/analytics";

interface FactsProps {
  summary: AnalyticsSummary;
}

function formatDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(UI_LOCALE, { day: "numeric", month: "short" });
}

function daysSince(iso: string): number {
  const from = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(from.getTime())) return 0;
  const today = new Date();
  const ms = today.setHours(0, 0, 0, 0) - from.getTime();
  return Math.max(0, Math.round(ms / 86_400_000)) + 1;
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0">
      <div className="text-sm font-medium truncate" style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 truncate">
        {label}
      </div>
    </div>
  );
}

/**
 * The things the database knows and nothing on the page was saying.
 *
 * The split between local and server was computed by Rust and thrown away by
 * the interface, and the rest comes from daily_stats, which outlives a history
 * that gets pruned.
 */
export function Facts({ summary }: FactsProps) {
  if (summary.totalTranscriptions === 0) return null;

  const dictated = summary.localCount + summary.serverCount;
  const localShare = dictated > 0 ? Math.round((summary.localCount / dictated) * 100) : 100;

  return (
    <div className="grid grid-cols-4 gap-3 px-4 py-3 rounded-xl border border-border-card bg-surface-raised/50">
      <Fact
        value={summary.firstDay ? `${daysSince(summary.firstDay)} days` : "--"}
        label={summary.firstDay ? `since ${formatDay(summary.firstDay)}` : "dictating"}
      />
      <Fact
        value={summary.streak > 0 ? `${summary.streak} in a row` : "--"}
        label={summary.streak > 0 ? "current streak" : "no streak going"}
      />
      <Fact
        value={summary.bestDayCount > 0 ? summary.bestDayCount.toLocaleString(UI_LOCALE) : "--"}
        label={summary.bestDay ? `best day, ${formatDay(summary.bestDay)}` : "best day"}
      />
      <Fact
        value={`${localShare}% local`}
        label={
          summary.serverCount > 0
            ? `${summary.serverCount.toLocaleString(UI_LOCALE)} through the server`
            : "never left the machine"
        }
      />
    </div>
  );
}
