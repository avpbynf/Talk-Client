import type { AnalyticsSummary } from "@/lib/analytics";

interface StatsCardsProps {
  summary: AnalyticsSummary;
}

function formatTime(minutes: number): string {
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface StatCellProps {
  label: string;
  value: string;
  detail: string;
  colorVar: string;
}

function StatCell({ label, value, detail, colorVar }: StatCellProps) {
  return (
    <div className="flex-1 min-w-0 px-4 py-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="h-1.5 w-1.5 rounded-full shrink-0"
          style={{ backgroundColor: `var(${colorVar})` }}
        />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium truncate">
          {label}
        </span>
      </div>
      <div
        className="text-lg font-semibold font-mono tracking-tight leading-none"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </div>
      <p className="text-[10px] text-muted-foreground/50 mt-1 truncate leading-tight">
        {detail}
      </p>
    </div>
  );
}

export function StatsCards({ summary }: StatsCardsProps) {
  return (
    <div className="flex items-stretch divide-x divide-border-subtle/50 rounded-lg border border-border-card bg-surface-raised/50 overflow-hidden">
      <StatCell
        label="Transcriptions"
        value={String(summary.todayCount)}
        detail={`${summary.weekCount} sem. \u00b7 ${summary.totalTranscriptions} total`}
        colorVar="--color-active"
      />
      <StatCell
        label="Mots"
        value={summary.totalWords.toLocaleString()}
        detail={`${summary.totalCharacters.toLocaleString()} car.`}
        colorVar="--color-hybrid"
      />
      <StatCell
        label="Economie"
        value={`$${summary.costSavedUsd.toFixed(2)}`}
        detail={`~${summary.estimatedAudioMinutes.toFixed(1)} min audio`}
        colorVar="--color-success"
      />
      <StatCell
        label="Temps gagne"
        value={formatTime(summary.timeSavedMinutes)}
        detail="vs frappe manuelle"
        colorVar="--color-warning"
      />
    </div>
  );
}
