import { RecordingMode } from "@/App";
import type { CompanionShortcut } from "@/App";
import type { OverlayThemeId } from "@/lib/overlay-themes";
import { ScrollArea } from "@/components/ui/scroll-area";
import RecordingModeSection from "./preferences/RecordingModeSection";
import ShortcutsSection from "./preferences/ShortcutsSection";
import CompanionShortcutsSection from "./preferences/CompanionShortcutsSection";
import MeetingModeSection from "./preferences/MeetingModeSection";
import SoundFeedbackSection from "./preferences/SoundFeedbackSection";
import OverlaySection from "./preferences/OverlaySection";
import SystemSection from "./preferences/SystemSection";

interface PreferencesViewProps {
  recordingMode: RecordingMode;
  onRecordingModeChange: (mode: RecordingMode) => void;
  shortcut: string;
  onShortcutChange: (shortcut: string) => Promise<void>;
  cancelShortcut: string;
  onCancelShortcutChange: (shortcut: string) => Promise<void>;
  autostartEnabled: boolean;
  onAutostartChange: (enabled: boolean) => void;
  startMinimized: boolean;
  onStartMinimizedChange: (enabled: boolean) => void;
  pauseMediaOnRecord: boolean;
  onPauseMediaOnRecordChange: (enabled: boolean) => void;
  preserveClipboard: boolean;
  onPreserveClipboardChange: (enabled: boolean) => void;
  soundFeedback: boolean;
  onSoundFeedbackChange: (enabled: boolean) => void;
  startSound: string;
  onStartSoundChange: (preset: string) => void;
  stopSound: string;
  onStopSoundChange: (preset: string) => void;
  companionShortcuts: CompanionShortcut[];
  onCompanionShortcutsChange: (shortcuts: CompanionShortcut[]) => void;
  overlayTheme: OverlayThemeId;
  onOverlayThemeChange: (theme: OverlayThemeId) => void;
}

export default function PreferencesView({
  recordingMode,
  onRecordingModeChange,
  shortcut,
  onShortcutChange,
  cancelShortcut,
  onCancelShortcutChange,
  autostartEnabled,
  onAutostartChange,
  startMinimized,
  onStartMinimizedChange,
  pauseMediaOnRecord,
  onPauseMediaOnRecordChange,
  preserveClipboard,
  onPreserveClipboardChange,
  soundFeedback,
  onSoundFeedbackChange,
  startSound,
  onStartSoundChange,
  stopSound,
  onStopSoundChange,
  companionShortcuts,
  onCompanionShortcutsChange,
  overlayTheme,
  onOverlayThemeChange,
}: PreferencesViewProps) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border-subtle shrink-0">
        <h1 className="text-xl font-semibold tracking-tight">Préférences</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Raccourcis clavier et apparence de l'overlay
        </p>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            <ShortcutsSection
              shortcut={shortcut}
              onShortcutChange={onShortcutChange}
              cancelShortcut={cancelShortcut}
              onCancelShortcutChange={onCancelShortcutChange}
              recordingMode={recordingMode}
            />
            <RecordingModeSection
              recordingMode={recordingMode}
              onRecordingModeChange={onRecordingModeChange}
            />
            <CompanionShortcutsSection
              companionShortcuts={companionShortcuts}
              onCompanionShortcutsChange={onCompanionShortcutsChange}
            />
            <MeetingModeSection />
            <OverlaySection
              overlayTheme={overlayTheme}
              onOverlayThemeChange={onOverlayThemeChange}
            />
            <SoundFeedbackSection
              soundFeedback={soundFeedback}
              onSoundFeedbackChange={onSoundFeedbackChange}
              startSound={startSound}
              onStartSoundChange={onStartSoundChange}
              stopSound={stopSound}
              onStopSoundChange={onStopSoundChange}
            />
            <SystemSection
              autostartEnabled={autostartEnabled}
              onAutostartChange={onAutostartChange}
              startMinimized={startMinimized}
              onStartMinimizedChange={onStartMinimizedChange}
              pauseMediaOnRecord={pauseMediaOnRecord}
              onPauseMediaOnRecordChange={onPauseMediaOnRecordChange}
              preserveClipboard={preserveClipboard}
              onPreserveClipboardChange={onPreserveClipboardChange}
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
