import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  COMPETITORS,
  PRICES_CHECKED,
  billingStart,
  formatMonth,
  monthsSince,
} from "@/lib/analytics";
import type { AnalyticsSummary } from "@/lib/analytics";

interface SubscriptionComparisonProps {
  summary: AnalyticsSummary;
}

export function SubscriptionComparison({ summary }: SubscriptionComparisonProps) {
  const start = billingStart(summary);
  const months = monthsSince(start);

  return (
    <Card className="bg-surface-raised border-border-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Against a subscription</CardTitle>
      </CardHeader>
      <CardContent>
        {months === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            Nothing dictated yet. This starts counting on the first one.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground/70 -mt-1 mb-3">
              {months} month{months !== 1 ? "s" : ""} from {formatMonth(start)}
            </p>

            {COMPETITORS.map((c) => (
              <div key={c.name} className="py-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm min-w-0 truncate">{c.name}</span>
                  <span className="text-sm shrink-0 line-through decoration-1 decoration-[var(--color-destructive)]/40 text-[var(--color-destructive)]">
                    ${(c.monthlyUsd * months).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3 text-[11px] text-muted-foreground/50">
                  <span className="min-w-0 truncate">{c.note}</span>
                  <span className="shrink-0">${c.monthlyUsd.toFixed(2)}/mo</span>
                </div>
              </div>
            ))}

            <div className="h-px bg-border-subtle my-1" />

            <div className="flex items-center justify-between py-2">
              <span className="text-sm">Talk</span>
              <span className="text-sm text-[var(--color-success)] font-semibold">
                $0.00
              </span>
            </div>

            <p className="text-[10px] text-muted-foreground/40 mt-2 leading-tight">
              Prices as published, {PRICES_CHECKED}. Windows tools only.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
