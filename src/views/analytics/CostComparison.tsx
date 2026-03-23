import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyticsSummary } from "@/lib/analytics";

interface CostComparisonProps {
  summary: AnalyticsSummary;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-mono">{children}</span>
    </div>
  );
}

export function CostComparison({ summary }: CostComparisonProps) {
  const total = summary.localCount + summary.serverCount;
  const localPercent = total > 0 ? (summary.localCount / total) * 100 : 100;

  return (
    <Card className="bg-surface-raised border-border-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Économies vs OpenAI</CardTitle>
      </CardHeader>
      <CardContent>
        <Row label="Audio estimé">~{summary.estimatedAudioMinutes.toFixed(1)} min</Row>
        <Row label="Tarif Whisper API">$0.006 / min</Row>
        <Row label="Coût équivalent">
          <span className="line-through text-[var(--color-destructive)] decoration-2">
            ${summary.costSavedUsd.toFixed(2)}
          </span>
        </Row>

        <div className="h-px bg-border-subtle my-1" />

        <Row label="Coût T4lk">
          <span className="text-[var(--color-success)] font-semibold">$0.00</span>
        </Row>

        {/* Local / Server split */}
        <div className="pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Répartition</span>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-[var(--color-active)]" />
                {summary.localCount} local
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-[var(--color-server)]" />
                {summary.serverCount} serveur
              </span>
            </div>
          </div>
          <div className="h-1.5 w-full rounded-full bg-surface-active overflow-hidden flex">
            <div
              className="h-full rounded-full bg-[var(--color-active)] transition-all duration-500"
              style={{ width: `${localPercent}%` }}
            />
            {summary.serverCount > 0 && (
              <div className="h-full flex-1 bg-[var(--color-server)] transition-all duration-500" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
