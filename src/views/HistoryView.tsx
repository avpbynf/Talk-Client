import { Transcription } from "@/App";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Trash2, Sparkles, Clock, Check, Mic } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface HistoryViewProps {
  transcriptions: Transcription[];
  onClear: () => void;
  shortcut: string;
}

export default function HistoryView({ transcriptions, onClear, shortcut }: HistoryViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Aujourd'hui";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Hier";
    }
    return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  };

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-[oklch(0.22_0.015_260)] flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Historique</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {transcriptions.length} transcription{transcriptions.length !== 1 ? 's' : ''}
          </p>
        </div>
        {transcriptions.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Effacer tout
          </Button>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0 w-full">
        {transcriptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground px-4">
            <div className="relative mb-6">
              <div className="h-24 w-24 rounded-2xl bg-[oklch(0.18_0.015_260)] flex items-center justify-center">
                <Mic className="h-12 w-12 text-muted-foreground/50" strokeWidth={1.5} />
              </div>
              <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-lg bg-[oklch(0.22_0.02_260)] flex items-center justify-center border border-[oklch(0.28_0.015_260)]">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <p className="text-lg font-medium text-foreground/80 mb-2">Aucune transcription</p>
            <p className="text-sm text-center max-w-[280px] leading-relaxed">
              Utilisez{" "}
              {shortcut.split("+").map((key, i, arr) => (
                <span key={key}>
                  <kbd>{key}</kbd>
                  {i < arr.length - 1 && (
                    <span className="text-muted-foreground/60 mx-1">+</span>
                  )}
                </span>
              ))}
              {" "}pour commencer à enregistrer
            </p>
          </div>
        ) : (
          <div className="p-6">
            <div className="max-w-2xl mx-auto space-y-3">
              {transcriptions.map((t) => (
                <div
                  key={t.id}
                  className={cn(
                    "stagger-item group p-4 rounded-xl border border-[oklch(0.25_0.015_260)] bg-[oklch(0.15_0.01_260)] card-interactive overflow-hidden"
                  )}
                >
                  {/* Text content */}
                  <p className="text-sm break-words leading-relaxed text-foreground/90">
                    {t.text}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-[oklch(0.22_0.015_260)]">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        {formatTime(t.timestamp)}
                      </span>
                      <span className="text-muted-foreground/40">·</span>
                      <span>{formatDate(t.timestamp)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {t.model && (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[oklch(0.20_0.01_260)]">
                          {t.model}
                        </span>
                      )}
                      {t.enhanced && (
                        <span className="badge-active text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-1">
                          <Sparkles className="h-2.5 w-2.5" />
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-7 w-7 shrink-0 rounded-lg transition-all duration-200",
                          copiedId === t.id
                            ? "bg-[var(--color-success)]/15 text-[var(--color-success)]"
                            : "opacity-0 group-hover:opacity-100 hover:bg-[oklch(0.25_0.02_260)]"
                        )}
                        onClick={() => copyToClipboard(t.text, t.id)}
                      >
                        {copiedId === t.id ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
