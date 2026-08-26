import { RecordingMode } from "@/App";
import type { CompanionShortcut } from "@/App";
import { ScrollArea } from "@/components/ui/scroll-area";
import InputDeviceSection from "./preferences/InputDeviceSection";
import RecordingModeSection from "./preferences/RecordingModeSection";
import ShortcutsSection from "./preferences/ShortcutsSection";
import CompanionShortcutsSection from "./preferences/CompanionShortcutsSection";
import MeetingModeSection from "./preferences/MeetingModeSection";
import SoundFeedbackSection from "./preferences/SoundFeedbackSection";
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
  companionShortcuts: CompanionShortcut[];
  onCompanionShortcutsChange: (shortcuts: CompanionShortcut[]) => void;
  soundFeedback: boolean;
  onSoundFeedbackChange: (enabled: boolean) => void;
  startSound: string;
  onStartSoundChange: (preset: string) => void;
  stopSound: string;
  onStopSoundChange: (preset: string) => void;
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
  companionShortcuts,
  onCompanionShortcutsChange,
  soundFeedback,
  onSoundFeedbackChange,
  startSound,
  onStartSoundChange,
  stopSound,
  onStopSoundChange,
}: PreferencesViewProps) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Page title */}
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Preferences</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Recording, shortcuts and how it behaves on the system
              </p>
            </div>

            {/* Separator */}
            <div className="h-px bg-border-subtle" />

            <InputDeviceSection />
            <RecordingModeSection
              recordingMode={recordingMode}
              onRecordingModeChange={onRecordingModeChange}
            />
            <ShortcutsSection
              shortcut={shortcut}
              onShortcutChange={onShortcutChange}
              cancelShortcut={cancelShortcut}
              onCancelShortcutChange={onCancelShortcutChange}
              recordingMode={recordingMode}
            />
            <SoundFeedbackSection
              soundFeedback={soundFeedback}
              onSoundFeedbackChange={onSoundFeedbackChange}
              startSound={startSound}
              onStartSoundChange={onStartSoundChange}
              stopSound={stopSound}
              onStopSoundChange={onStopSoundChange}
            />
            <CompanionShortcutsSection
              companionShortcuts={companionShortcuts}
              onCompanionShortcutsChange={onCompanionShortcutsChange}
            />
            <MeetingModeSection />
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
