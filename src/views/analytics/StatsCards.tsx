import { type LucideIcon, MessageSquareText, Type, PiggyBank, Timer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { AnalyticsSummary } from "@/lib/analytics";

interface StatsCardsProps {
  summary: AnalyticsSummary;
}

function formatTime(minutes: number): string {
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface StatCardProps {
  icon: LucideIcon;
  title: string;
  value: string;
  secondary: string;
  colorVar: string;
}

function StatCard({ icon: Icon, title, value, secondary, colorVar }: StatCardProps) {
  return (
    <Card className="bg-surface-raised border-border-card overflow-hidden hover-lift">
      <CardContent className="p-0">
        <div className="flex h-full">
          {/* Accent stripe */}
          <div
            className="w-1 shrink-0"
            style={{ backgroundColor: `var(${colorVar})` }}
          />
          <div className="p-5 flex-1 min-w-0">
            {/* Icon + title row */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className="h-9 w-9 rounded-lg shrink-0 flex items-center justify-center"
                style={{
                  backgroundColor: `color-mix(in oklch, var(${colorVar}) 12%, transparent)`,
                }}
              >
                <Icon size={18} style={{ color: `var(${colorVar})` }} />
              </div>
              <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                {title}
              </span>
            </div>
            {/* Value */}
            <div
              className="text-3xl font-semibold tracking-tight font-mono"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {value}
            </div>
            {/* Secondary */}
            <p className="text-xs text-muted-foreground/60 mt-2 leading-relaxed">
              {secondary}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function StatsCards({ summary }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <StatCard
        icon={MessageSquareText}
        title="Transcriptions"
        value={String(summary.todayCount)}
        secondary={`${summary.weekCount} cette semaine \u00b7 ${summary.totalTranscriptions} au total`}
        colorVar="--color-active"
      />
      <StatCard
        icon={Type}
        title="Mots transcrits"
        value={summary.totalWords.toLocaleString()}
        secondary={`${summary.totalCharacters.toLocaleString()} caracteres`}
        colorVar="--color-hybrid"
      />
      <StatCard
        icon={PiggyBank}
        title="Economie estimee"
        value={`$${summary.costSavedUsd.toFixed(2)}`}
        secondary={`~${summary.estimatedAudioMinutes.toFixed(1)} min audio estimees`}
        colorVar="--color-success"
      />
      <StatCard
        icon={Timer}
        title="Temps economise"
        value={formatTime(summary.timeSavedMinutes)}
        secondary="vs frappe manuelle"
        colorVar="--color-warning"
      />
    </div>
  );
}
