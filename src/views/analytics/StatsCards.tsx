import { UI_LOCALE, cheapestApiCost } from "@/lib/analytics";
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

interface StatCardProps {
  label: string;
  value: string;
  detail: string;
  colorVar: string;
}

function StatCard({ label, value, detail, colorVar }: StatCardProps) {
  return (
    <div className="min-w-0 px-4 py-3 rounded-xl border border-border-card bg-surface-raised">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className="h-1.5 w-1.5 rounded-full shrink-0"
          style={{ backgroundColor: `var(${colorVar})` }}
        />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium truncate">
          {label}
        </span>
      </div>
      <div
        className="text-[22px] font-semibold tracking-tight leading-none"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </div>
      <p className="text-[10px] text-muted-foreground/50 mt-1.5 truncate leading-tight">
        {detail}
      </p>
    </div>
  );
}

export function StatsCards({ summary }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-4 gap-3">
      <StatCard
        label="Dictations"
        value={summary.totalTranscriptions.toLocaleString(UI_LOCALE)}
        detail={`${summary.todayCount} today, ${summary.weekCount} this week`}
        colorVar="--color-active"
      />
      <StatCard
        label="Words"
        value={summary.totalWords.toLocaleString(UI_LOCALE)}
        detail={`${summary.totalCharacters.toLocaleString(UI_LOCALE)} characters`}
        colorVar="--color-hybrid"
      />
      <StatCard
        label="Not spent"
        value={`$${cheapestApiCost(summary.estimatedAudioMinutes).toFixed(2)}`}
        detail={`${summary.estimatedAudioMinutes.toFixed(0)} min of audio`}
        colorVar="--color-success"
      />
      <StatCard
        label="Time won"
        value={formatTime(summary.timeSavedMinutes)}
        detail="against typing it"
        colorVar="--color-warning"
      />
    </div>
  );
}
