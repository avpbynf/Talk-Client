import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyticsSummary } from "@/lib/analytics";

interface TimeSavedProps {
  summary: AnalyticsSummary;
  userWpm: number;
  onRecalibrate: () => void;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-mono">{children}</span>
    </div>
  );
}

function formatTime(minutes: number): string {
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `~${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `~${h}h ${m}m` : `~${h}h`;
}

export function TimeSaved({ summary, userWpm, onRecalibrate }: TimeSavedProps) {
  return (
    <Card className="bg-surface-raised border-border-card">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-medium">Time won</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-4">
          <div
            className="text-4xl font-bold font-mono tracking-tight text-[var(--color-warning)]"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {formatTime(summary.timeSavedMinutes)}
          </div>
          <p className="text-xs text-muted-foreground/60 mt-1.5">against typing it yourself</p>
        </div>

        <div className="h-px bg-border-subtle" />

        <Row label="Your typing speed">
          <div className="flex items-center gap-2">
            <span>{userWpm} wpm</span>
            <button
              onClick={onRecalibrate}
              className="text-[10px] text-[var(--color-active)] hover:underline"
            >
              Retest
            </button>
          </div>
        </Row>
        <Row label="Words dictated">{summary.totalWords.toLocaleString()}</Row>
        <Row label="Typing that out">{Math.round(summary.timeSavedMinutes)} min</Row>
        <Row label="Saying it instead">
          <span className="text-muted-foreground/60">
            ~{summary.estimatedAudioMinutes.toFixed(0)} min
          </span>
        </Row>
      </CardContent>
    </Card>
  );
}
