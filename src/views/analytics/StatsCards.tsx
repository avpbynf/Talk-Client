import {
  UI_LOCALE,
  averageDictationSeconds,
  realtimeFactor,
  speakingRate,
} from "@/lib/analytics";
import type { AnalyticsSummary } from "@/lib/analytics";

interface StatsCardsProps {
  summary: AnalyticsSummary;
  userWpm: number;
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

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m} min ${s} s` : `${m} min`;
}

/**
 * The four figures nothing below repeats.
 *
 * Money and time won used to sit here as well, and both are the headline of a
 * card further down the page, so the top row said what the reader was about to
 * read anyway. The word count went the same way: the time card lists it.
 */
export function StatsCards({ summary, userWpm }: StatsCardsProps) {
  const rate = speakingRate(summary);
  const factor = realtimeFactor(summary);
  const average = averageDictationSeconds(summary);

  // Nothing kept carries a duration on a fresh install, and dividing by it
  // would print an infinity where a figure belongs.
  const waiting = "not measured yet";

  return (
    <div className="grid grid-cols-4 gap-3">
      <StatCard
        label="Dictations"
        value={summary.totalTranscriptions.toLocaleString(UI_LOCALE)}
        detail={`${summary.todayCount} today, ${summary.weekCount} this week`}
        colorVar="--color-active"
      />
      <StatCard
        label="You speak at"
        value={rate === null ? "--" : `${Math.round(rate)} wpm`}
        detail={rate === null ? waiting : `you type at ${userWpm}`}
        colorVar="--color-hybrid"
      />
      <StatCard
        label="Faster than real time"
        value={factor === null ? "--" : `${factor.toFixed(1)}x`}
        detail={
          factor === null
            ? waiting
            : `${summary.measuredCount.toLocaleString(UI_LOCALE)} dictations timed`
        }
        colorVar="--color-success"
      />
      <StatCard
        label="A dictation lasts"
        value={average === null ? "--" : formatSeconds(average)}
        detail={
          average === null
            ? waiting
            : `${Math.round(summary.measuredWords / summary.measuredCount)} words on average`
        }
        colorVar="--color-warning"
      />
    </div>
  );
}
