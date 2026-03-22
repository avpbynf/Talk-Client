import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DailyStats } from "@/lib/analytics";

interface ActivityChartProps {
  dailyStats: DailyStats[];
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function ActivityChart({ dailyStats }: ActivityChartProps) {
  const maxCount = Math.max(...dailyStats.map((s) => s.count), 1);
  const allZero = dailyStats.every((s) => s.count === 0);
  const weekTotal = dailyStats.reduce((sum, s) => sum + s.count, 0);
  const todayKey = new Date().toISOString().slice(0, 10);

  return (
    <Card className="bg-surface-raised border-border-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Activite</CardTitle>
          {!allZero && (
            <span className="text-xs font-mono text-muted-foreground bg-surface-active px-2 py-0.5 rounded-md">
              {weekTotal} cette semaine
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {allZero ? (
          <div className="h-44 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Aucune activite cette semaine</p>
          </div>
        ) : (
          <div className="relative">
            {/* Subtle grid lines */}
            <div className="absolute inset-x-0 top-0 bottom-8 flex flex-col justify-between pointer-events-none" aria-hidden="true">
              <div className="border-b border-dashed border-border-subtle/30" />
              <div className="border-b border-dashed border-border-subtle/30" />
              <div className="border-b border-dashed border-border-subtle/30" />
            </div>

            {/* Bars */}
            <div className="relative flex items-end gap-3 h-44 pb-8">
              {dailyStats.map((stats, index) => {
                const isToday = stats.date === todayKey;
                const heightPercent = stats.count > 0
                  ? Math.max((stats.count / maxCount) * 100, 4)
                  : 0;

                return (
                  <div key={stats.date} className="flex flex-col items-center flex-1 h-full">
                    <div className="flex-1 flex items-end w-full relative group">
                      {/* Hover tooltip */}
                      {stats.count > 0 && (
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-10">
                          <div className="bg-surface-elevated border border-border-card rounded-lg px-2.5 py-1.5 text-xs font-mono whitespace-nowrap shadow-lg">
                            <span className="font-semibold">{stats.count}</span>
                            <span className="text-muted-foreground ml-1">
                              transcription{stats.count !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                      )}
                      {/* Bar with gradient */}
                      <div
                        className="w-full rounded-t-md transition-all duration-500 ease-out"
                        style={{
                          height: `${heightPercent}%`,
                          transitionDelay: `${index * 60}ms`,
                          background: isToday
                            ? "linear-gradient(to top, color-mix(in oklch, var(--color-active) 40%, transparent), var(--color-active))"
                            : "linear-gradient(to top, color-mix(in oklch, var(--color-active) 15%, transparent), color-mix(in oklch, var(--color-active) 60%, transparent))",
                          boxShadow: isToday
                            ? "0 0 12px var(--color-active-glow), 0 -2px 8px var(--color-active-glow)"
                            : "none",
                        }}
                      />
                    </div>
                    {/* Day label */}
                    <span
                      className={
                        isToday
                          ? "text-xs mt-2 shrink-0 font-medium text-[var(--color-active)]"
                          : "text-xs mt-2 shrink-0 text-muted-foreground"
                      }
                    >
                      {capitalize(stats.label)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
