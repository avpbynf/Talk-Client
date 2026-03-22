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
        <CardTitle className="text-sm font-medium">Temps economise</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Hero number */}
        <div className="text-center py-4">
          <div
            className="text-4xl font-bold font-mono tracking-tight text-[var(--color-warning)]"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {formatTime(summary.timeSavedMinutes)}
          </div>
          <p className="text-xs text-muted-foreground/60 mt-1.5">vs frappe manuelle</p>
        </div>

        <div className="h-px bg-border-subtle" />

        {/* Breakdown */}
        <Row label="Vitesse de frappe">
          <div className="flex items-center gap-2">
            <span>{userWpm} mots/min</span>
            <button
              onClick={onRecalibrate}
              className="text-[10px] text-[var(--color-active)] hover:underline"
            >
              Modifier
            </button>
          </div>
        </Row>
        <Row label="Mots transcrits">{summary.totalWords.toLocaleString()}</Row>
        <Row label="Frappe equivalente">{summary.timeSavedMinutes.toFixed(1)} min</Row>
        <Row label="Transcription reelle">
          <span className="text-muted-foreground/60">~quelques sec.</span>
        </Row>
      </CardContent>
    </Card>
  );
}
