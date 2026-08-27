import { Transcription } from "@/App";
import { UI_LOCALE } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { RETENTION_OPTIONS, retentionWouldDelete } from "@/lib/retention";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Sparkles, Clock, Globe, HardDrive, ClipboardCheck } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface HistoryViewProps {
  transcriptions: Transcription[];
  onClear: () => void;
  shortcut: string;
  historyLimit: number;
  onHistoryLimitChange: (limit: number) => void;
}

export default function HistoryView({
  transcriptions,
  onClear,
  shortcut,
  historyLimit,
  onHistoryLimitChange,
}: HistoryViewProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  // A retention choice waiting on the reader, set only when applying it
  // would delete something.
  const [pendingLimit, setPendingLimit] = useState<number | null>(null);

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(UI_LOCALE, {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }
    return date.toLocaleDateString(UI_LOCALE, { day: "numeric", month: "short" });
  };

  const isEmpty = transcriptions.length === 0;

  return (
    <div className="relative h-full w-full flex flex-col overflow-hidden">
      <ScrollArea className="flex-1 min-h-0 w-full">
        <div className="p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Header — always visible */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">History</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {isEmpty
                    ? "Nothing dictated yet"
                    : `${transcriptions.length} transcription${transcriptions.length !== 1 ? "s" : ""}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={String(historyLimit)}
                  onValueChange={(value) => {
                    const limit = Number(value);
                    if (retentionWouldDelete(transcriptions.length, limit) > 0) {
                      setPendingLimit(limit);
                    } else {
                      onHistoryLimitChange(limit);
                    }
                  }}
                >
                  <SelectTrigger
                    aria-label="How much history to keep"
                    title="How much history to keep"
                    className="w-[11rem] cursor-pointer bg-surface-deep border-border-card text-foreground"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RETENTION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={String(option.value)}>
                        Keep {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setConfirmClear(true)}
                  disabled={isEmpty}
                  aria-label="Clear the whole history"
                  title="Clear the whole history"
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="h-px bg-border-subtle" />

            {isEmpty ? (
              <p className="text-sm text-muted-foreground text-center leading-relaxed">
                Press
                <span className="mx-2 inline-flex items-center gap-1">
                  {shortcut.split("+").map((key, i, arr) => (
                    <span key={key} className="inline-flex items-center">
                      <kbd>{key}</kbd>
                      {i < arr.length - 1 && (
                        <span className="text-muted-foreground/60 mx-0.5">+</span>
                      )}
                    </span>
                  ))}
                </span>
                and start talking
              </p>
            ) : (
              <div className="space-y-3">
              <AnimatePresence initial={false}>
              {transcriptions.map((t) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                  }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: "hidden" }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ backgroundColor: "var(--color-surface-active)" }}
                  layout
                  onClick={() => copyToClipboard(t.text, t.id)}
                  className="group p-4 rounded-xl border border-border-card bg-surface-raised overflow-hidden cursor-pointer relative"
                >
                  {/* Copy feedback — floating ghost label */}
                  <AnimatePresence>
                    {copiedId === t.id && (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.85 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -14, scale: 0.9 }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                        className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-elevated border border-border-card shadow-lg pointer-events-none"
                      >
                        <ClipboardCheck size={14} className="text-[var(--color-success)]" />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Text content */}
                  <p className="selectable text-sm break-words leading-relaxed text-foreground/90">
                    {t.text}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border-subtle">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        {formatTime(t.timestamp)}
                      </span>
                      <span className="text-muted-foreground/40">·</span>
                      <span>{formatDate(t.timestamp)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {t.model && t.source !== "server" && (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-active">
                          {t.model}
                        </span>
                      )}
                      {(() => {
                        const source = t.source || "local";
                        return source === "server" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--color-server)]/10 text-[var(--color-server)] border border-[var(--color-server)]/20">
                            <Globe size={10} />
                            Server
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--color-active)]/10 text-[var(--color-active)] border border-[var(--color-active)]/20">
                            <HardDrive size={10} />
                            Local
                          </span>
                        );
                      })()}
                      {t.enhanced && (
                        <span className="badge-active text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-1">
                          <Sparkles className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
              </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      <ConfirmDialog
        open={confirmClear}
        title="Clear the whole history?"
        description={`All ${transcriptions.length} of them go, and they do not come back.`}
        confirmIcon={<Trash2 className="h-4 w-4 mr-2" />}
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          setConfirmClear(false);
          onClear();
        }}
      />

      <ConfirmDialog
        open={pendingLimit !== null}
        title={`Keep only ${pendingLimit} transcriptions?`}
        description={`${retentionWouldDelete(transcriptions.length, pendingLimit ?? 0)} older ones go, and they do not come back. The statistics keep counting them.`}
        confirmIcon={<Trash2 className="h-4 w-4 mr-2" />}
        onCancel={() => setPendingLimit(null)}
        onConfirm={() => {
          const limit = pendingLimit;
          setPendingLimit(null);
          if (limit !== null) onHistoryLimitChange(limit);
        }}
      />

    </div>
  );
}
