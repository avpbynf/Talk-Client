import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HOSTED_APIS, PRICES_CHECKED, apiCost } from "@/lib/analytics";
import type { AnalyticsSummary } from "@/lib/analytics";

interface CostComparisonProps {
  summary: AnalyticsSummary;
}

export function CostComparison({ summary }: CostComparisonProps) {
  const minutes = summary.estimatedAudioMinutes;

  return (
    <Card className="bg-surface-raised border-border-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Against a hosted API</CardTitle>
      </CardHeader>
      <CardContent>
        {minutes < 1 ? (
          <p className="text-sm text-muted-foreground py-2">
            Nothing dictated yet. This starts counting on the first one.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground/70 -mt-1 mb-3">
              ~{minutes.toFixed(0)} min of audio, had it been sent away
            </p>

            {HOSTED_APIS.map((api) => (
              <div key={api.name} className="py-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm min-w-0 truncate">{api.name}</span>
                  <span className="text-sm shrink-0 text-[var(--color-destructive)]">
                    ${apiCost(minutes, api).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3 text-[11px] text-muted-foreground/50">
                  <span className="min-w-0 truncate">{api.note}</span>
                  <span className="shrink-0">${api.usdPerMin.toFixed(4)}/min</span>
                </div>
              </div>
            ))}

            <p className="text-[10px] text-muted-foreground/40 mt-3 leading-tight">
              Prices as published, {PRICES_CHECKED}. Per minute of audio.
              {summary.serverCount > 0 &&
                ` ${summary.serverCount} of these went through your server, which costs whatever that server costs.`}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
