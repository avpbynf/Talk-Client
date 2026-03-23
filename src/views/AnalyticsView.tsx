import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Keyboard, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { loadUserWpm } from "@/lib/analytics";
import type { AnalyticsSummary, YearlyDayActivity } from "@/lib/analytics";
import { StatsCards } from "@/views/analytics/StatsCards";
import { ActivityChart } from "@/views/analytics/ActivityChart";
import { CostComparison } from "@/views/analytics/CostComparison";
import { TimeSaved } from "@/views/analytics/TimeSaved";
import { TypingGame } from "@/views/analytics/TypingGame";

export default function AnalyticsView() {
  const [userWpm, setUserWpm] = useState<number>(() => loadUserWpm());
  const [showGame, setShowGame] = useState(false);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [yearlyActivity, setYearlyActivity] = useState<YearlyDayActivity[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);

  const fetchAnalytics = useCallback(async (wpm: number) => {
    try {
      const [data, yearly] = await Promise.all([
        invoke<AnalyticsSummary>("db_get_analytics_summary", { userWpm: wpm }),
        invoke<YearlyDayActivity[]>("db_get_yearly_activity"),
      ]);
      setSummary(data);
      setYearlyActivity(yearly);
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    }
  }, []);

  const handleResetStats = useCallback(async () => {
    try {
      await invoke("db_reset_stats");
      setConfirmReset(false);
      fetchAnalytics(userWpm);
    } catch (err) {
      console.error("Failed to reset stats:", err);
    }
  }, [fetchAnalytics, userWpm]);

  // Fetch on mount
  useEffect(() => {
    fetchAnalytics(userWpm);
  }, [fetchAnalytics, userWpm]);

  // Refetch when a new transcription arrives
  useEffect(() => {
    const unlisten = listen("transcription-complete", () => {
      fetchAnalytics(userWpm);
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, [fetchAnalytics, userWpm]);

  if (!summary) {
    return (
      <div className="h-full w-full flex items-center justify-center text-muted-foreground">
        Chargement...
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <ScrollArea className="flex-1 min-h-0 w-full">
        <div className="p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Vue d'ensemble de votre utilisation
                </p>
              </div>
              {confirmReset ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmReset(false)}
                    className="text-muted-foreground"
                  >
                    Annuler
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetStats}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Confirmer
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmReset(true)}
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Réinitialiser
                </Button>
              )}
            </div>

            <div className="h-px bg-border-subtle" />

            {/* Stats grid */}
            <StatsCards summary={summary} />

            {/* Activity chart */}
            <ActivityChart yearlyActivity={yearlyActivity} />

            {/* Detail cards */}
            <div className="grid grid-cols-2 gap-4">
              <CostComparison summary={summary} />
              <TimeSaved
                summary={summary}
                userWpm={userWpm}
                onRecalibrate={() => setShowGame(true)}
              />
            </div>

            {/* Typing game: compact bar or expanded game */}
            {showGame ? (
              <TypingGame
                onWpmMeasured={(wpm) => {
                  setUserWpm(wpm);
                  setShowGame(false);
                }}
              />
            ) : (
              <button
                onClick={() => setShowGame(true)}
                className="w-full flex items-center justify-between px-5 py-3.5 rounded-xl border border-border-card bg-surface-raised text-sm text-muted-foreground hover:bg-surface-active hover:text-foreground hover:border-border-hover transition-all duration-200 group"
              >
                <div className="flex items-center gap-3">
                  <Keyboard
                    size={16}
                    className="text-muted-foreground/60 group-hover:text-[var(--color-active)] transition-colors"
                  />
                  <span>Tester votre vitesse de frappe</span>
                </div>
                <span className="font-mono text-xs text-muted-foreground/80 bg-surface-active px-2.5 py-1 rounded-md">
                  {userWpm} mots/min
                </span>
              </button>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
