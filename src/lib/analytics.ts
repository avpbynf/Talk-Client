export interface DailyStats {
  date: string;
  label: string;
  count: number;
  words: number;
}

export interface YearlyDayActivity {
  date: string;
  count: number;
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

export const TYPING_SENTENCES = [
  "La productivité est l'art de faire plus avec moins d'effort.",
  "Chaque minute économisée est une minute investie dans la création.",
  "La technologie devrait amplifier nos capacités, pas les remplacer.",
  "Un bon outil disparaît entre les mains de celui qui le maîtrise.",
  "Le temps est la seule ressource que l'on ne peut pas récupérer.",
  "Automatiser les tâches répétitives libère l'esprit pour l'essentiel.",
  "La voix est le moyen de communication le plus naturel qui existe.",
  "Transcrire ses pensées à la vitesse de la parole change tout.",
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
  return 40;
}

export function saveUserWpm(wpm: number): void {
  try {
    localStorage.setItem(WPM_STORAGE_KEY, String(wpm));
  } catch {
    /* ignore */
  }
}
