import type { Transcription } from "@/App";

const OPENAI_WHISPER_COST_PER_MINUTE = 0.006;
const AVERAGE_SPEECH_RATE_WPM = 150;
const DEFAULT_TYPING_WPM = 40;

export interface DailyStats {
  date: string;
  label: string;
  count: number;
  words: number;
}

export interface AnalyticsSummary {
  totalTranscriptions: number;
  totalWords: number;
  totalCharacters: number;
  estimatedAudioMinutes: number;
  costSavedUsd: number;
  timeSavedMinutes: number;
  localCount: number;
  serverCount: number;
  todayCount: number;
  weekCount: number;
  dailyStats: DailyStats[];
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function getDayLabel(date: Date): string {
  return date.toLocaleDateString("fr-FR", { weekday: "short" });
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function computeAnalytics(
  transcriptions: readonly Transcription[],
  userWpm: number = DEFAULT_TYPING_WPM,
): AnalyticsSummary {
  const now = new Date();
  const todayKey = toDateKey(now);

  const dailyMap = new Map<string, { count: number; words: number; label: string }>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dailyMap.set(toDateKey(d), { count: 0, words: 0, label: getDayLabel(d) });
  }

  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  let totalWords = 0;
  let totalChars = 0;
  let localCount = 0;
  let serverCount = 0;
  let todayCount = 0;
  let weekCount = 0;

  for (const t of transcriptions) {
    const words = countWords(t.text);
    totalWords += words;
    totalChars += t.text.length;

    if (t.source === "server") serverCount++;
    else localCount++;

    const key = toDateKey(t.timestamp);
    if (key === todayKey) todayCount++;
    if (t.timestamp >= weekAgo) weekCount++;

    const daily = dailyMap.get(key);
    if (daily) {
      daily.count++;
      daily.words += words;
    }
  }

  const estimatedAudioMinutes = totalWords / AVERAGE_SPEECH_RATE_WPM;
  const costSavedUsd = estimatedAudioMinutes * OPENAI_WHISPER_COST_PER_MINUTE;
  const timeSavedMinutes = totalWords / userWpm;

  const dailyStats: DailyStats[] = [];
  for (const [date, data] of dailyMap) {
    dailyStats.push({ date, ...data });
  }

  return {
    totalTranscriptions: transcriptions.length,
    totalWords,
    totalCharacters: totalChars,
    estimatedAudioMinutes,
    costSavedUsd,
    timeSavedMinutes,
    localCount,
    serverCount,
    todayCount,
    weekCount,
    dailyStats,
  };
}

export const TYPING_SENTENCES = [
  "La productivite est l'art de faire plus avec moins d'effort.",
  "Chaque minute economisee est une minute investie dans la creation.",
  "La technologie devrait amplifier nos capacites, pas les remplacer.",
  "Un bon outil disparait entre les mains de celui qui le maitrise.",
  "Le temps est la seule ressource que l'on ne peut pas recuperer.",
  "Automatiser les taches repetitives libere l'esprit pour l'essentiel.",
  "La voix est le moyen de communication le plus naturel qui existe.",
  "Transcrire ses pensees a la vitesse de la parole change tout.",
];

export function getRandomSentence(): string {
  return TYPING_SENTENCES[Math.floor(Math.random() * TYPING_SENTENCES.length)];
}

export function calculateWpm(charCount: number, elapsedMs: number): number {
  const words = charCount / 5;
  const minutes = elapsedMs / 60000;
  return minutes > 0 ? Math.round(words / minutes) : 0;
}

const WPM_STORAGE_KEY = "t4lk-user-wpm";

export function loadUserWpm(): number {
  try {
    const stored = localStorage.getItem(WPM_STORAGE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (parsed > 0 && parsed < 300) return parsed;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_TYPING_WPM;
}

export function saveUserWpm(wpm: number): void {
  try {
    localStorage.setItem(WPM_STORAGE_KEY, String(wpm));
  } catch {
    /* ignore */
  }
}
