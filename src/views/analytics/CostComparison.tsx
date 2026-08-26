import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { API_RATE_USD_PER_MIN } from "@/lib/analytics";
import type { AnalyticsSummary } from "@/lib/analytics";

interface CostComparisonProps {
  summary: AnalyticsSummary;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}

export function CostComparison({ summary }: CostComparisonProps) {
  const total = summary.localCount + summary.serverCount;
  const usesBoth = summary.localCount > 0 && summary.serverCount > 0;
  const localPercent = total > 0 ? (summary.localCount / total) * 100 : 0;

  return (
    <Card className="bg-surface-raised border-border-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Against a hosted API</CardTitle>
      </CardHeader>
      <CardContent>
        <Row label="Audio sent">~{summary.estimatedAudioMinutes.toFixed(0)} min</Row>
        <Row label="Their rate">${API_RATE_USD_PER_MIN.toFixed(3)} / min</Row>
        <Row label="What that comes to">
          <span className="line-through decoration-1 decoration-[var(--color-destructive)]/40 text-[var(--color-destructive)]">
            ${summary.costSavedUsd.toFixed(2)}
          </span>
        </Row>

        <div className="h-px bg-border-subtle my-1" />

        <Row label="What Talk cost">
          <span className="text-[var(--color-success)] font-semibold">$0.00</span>
        </Row>

        {/*
          Where it ran. Plenty of installs only ever use one of the two modes,
          and a bar cut in two has nothing to compare on those: state the fact
          in a line rather than painting a 100/0 split as if it were a balance.
        */}
        {total > 0 && (
          <div className="pt-3">
            {usesBoth ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Where it ran</span>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="h-2 w-2 rounded-full bg-[var(--color-active)]" />
                      {summary.localCount} local
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="h-2 w-2 rounded-full bg-[var(--color-server)]" />
                      {summary.serverCount} server
                    </span>
                  </div>
                </div>
                <div className="h-1.5 w-full rounded-full bg-surface-active overflow-hidden flex">
                  <div
                    className="h-full bg-[var(--color-active)] transition-all duration-500"
                    style={{ width: `${localPercent}%` }}
                  />
                  <div className="h-full flex-1 bg-[var(--color-server)] transition-all duration-500" />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Where it ran</span>
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className={
                      summary.serverCount > 0
                        ? "h-2 w-2 rounded-full bg-[var(--color-server)]"
                        : "h-2 w-2 rounded-full bg-[var(--color-active)]"
                    }
                  />
                  {summary.serverCount > 0 ? "always on the server" : "always on this machine"}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
