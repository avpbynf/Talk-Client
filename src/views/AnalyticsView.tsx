import { useState, useMemo } from "react";
import { Keyboard } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { computeAnalytics, loadUserWpm } from "@/lib/analytics";
import type { Transcription } from "@/App";
import { StatsCards } from "@/views/analytics/StatsCards";
import { ActivityChart } from "@/views/analytics/ActivityChart";
import { CostComparison } from "@/views/analytics/CostComparison";
import { TimeSaved } from "@/views/analytics/TimeSaved";
import { TypingGame } from "@/views/analytics/TypingGame";

interface AnalyticsViewProps {
  transcriptions: Transcription[];
}

export default function AnalyticsView({ transcriptions }: AnalyticsViewProps) {
  const [userWpm, setUserWpm] = useState<number>(() => loadUserWpm());
  const [showGame, setShowGame] = useState(false);

  const summary = useMemo(
    () => computeAnalytics(transcriptions, userWpm),
    [transcriptions, userWpm],
  );

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <ScrollArea className="flex-1 min-h-0 w-full">
        <div className="p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Accueil</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Vue d'ensemble de votre utilisation
              </p>
            </div>

            <div className="h-px bg-border-subtle" />

            {/* Stats grid */}
            <StatsCards summary={summary} />

            {/* Activity chart */}
            <ActivityChart dailyStats={summary.dailyStats} />

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
