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
  /** ISO date of the first day anything was dictated, or null on a fresh install. */
  firstDay: string | null;
  /** First day of the selected window, null when the window is the whole history. */
  periodStart: string | null;
  dailyStats: DailyStats[];
  /** Dictations still kept that carry a real duration and a real processing time. */
  measuredCount: number;
  measuredWords: number;
  measuredAudioMinutes: number;
  measuredProcessingMinutes: number;
  bestDay: string | null;
  bestDayCount: number;
  activeDays: number;
  streak: number;
}

/**
 * How fast you actually speak, in words per minute.
 *
 * Measured, unlike `estimatedAudioMinutes`, which divides the word count by a
 * fixed 150 wpm and therefore cannot tell you anything about your own rate.
 * Null while nothing kept carries a duration, which is the state of a fresh
 * install and of a history cleared since the timings existed.
 */
export function speakingRate(summary: AnalyticsSummary): number | null {
  if (summary.measuredCount === 0 || summary.measuredAudioMinutes <= 0) return null;
  return summary.measuredWords / summary.measuredAudioMinutes;
}

/** How many seconds of speech the machine transcribes per second of work. */
export function realtimeFactor(summary: AnalyticsSummary): number | null {
  if (summary.measuredCount === 0 || summary.measuredProcessingMinutes <= 0) return null;
  return summary.measuredAudioMinutes / summary.measuredProcessingMinutes;
}

/** Seconds of speech in an average dictation, from what was measured. */
export function averageDictationSeconds(summary: AnalyticsSummary): number | null {
  if (summary.measuredCount === 0) return null;
  return (summary.measuredAudioMinutes * 60) / summary.measuredCount;
}

export type Period = "today" | "week" | "month" | "year" | "all";

/** Days counted back from today, today included. Null asks for everything. */
export const PERIOD_DAYS: Record<Period, number | null> = {
  today: 1,
  week: 7,
  month: 30,
  year: 365,
  all: null,
};

export const PERIOD_LABELS: Record<Period, string> = {
  today: "Today",
  week: "7 days",
  month: "30 days",
  year: "Year",
  all: "All time",
};

/**
 * What the alternatives cost, as published on the date below.
 *
 * These rot: Wispr Flow was $19 before it was $15, and Dragon Anywhere stopped
 * taking new subscriptions in July 2026. The date is rendered under the card so
 * a stale figure announces itself instead of quietly misleading. Re-check it
 * before any release that touches this file.
 */
export const PRICES_CHECKED = "August 2026";

export interface Competitor {
  name: string;
  /** Cheapest recurring price a single user can pay, in USD per month. */
  monthlyUsd: number;
  note: string;
}

/**
 * Windows dictation tools only. Aqua Voice and the Mac-only builds are left out
 * on purpose: comparing against something that does not run here would be
 * flattering and false.
 */
export const COMPETITORS: readonly Competitor[] = [
  { name: "Wispr Flow", monthlyUsd: 12, note: "Pro, billed yearly" },
  { name: "Dragon Professional", monthlyUsd: 15, note: "Anywhere, per user" },
  { name: "superwhisper", monthlyUsd: 8.49, note: "monthly" },
];

/**
 * The locale every figure on the page is formatted in.
 *
 * Not the system one: on a French Windows that printed "2 733" with a narrow
 * space and "août 2026" inside an English page. This follows the interface,
 * so translating it later means changing one line.
 */
export const UI_LOCALE = "en-US";

export interface HostedApi {
  name: string;
  /** List price in USD per minute of audio. */
  usdPerMin: number;
  note: string;
}

/**
 * The hosted transcription APIs the audio could have been sent to instead.
 *
 * Deliberately a spread rather than the three cheapest: a comparison that only
 * ever picks flattering numbers is not worth showing. The cheap end, the one
 * everybody knows, and a major cloud.
 *
 * These rot like the subscription prices do, and they are read straight off
 * this table by both the card and the headline figure. There is no second copy
 * to drift from, which there used to be.
 */
export const HOSTED_APIS: readonly HostedApi[] = [
  { name: "Deepgram Nova", usdPerMin: 0.0043, note: "pay as you go" },
  { name: "OpenAI Whisper", usdPerMin: 0.006, note: "list price" },
  { name: "Azure Speech to Text", usdPerMin: 0.0167, note: "standard, per hour billed" },
];

/** What a run of audio would have cost at one provider's rate. */
export function apiCost(minutes: number, api: HostedApi): number {
  return minutes * api.usdPerMin;
}

/**
 * Whole months between a date and today, floored at one.
 *
 * A subscription bills from the day you start, so a tool used for a week has
 * already cost a month. Counting calendar months rather than dividing days
 * keeps it honest against how the alternatives actually charge.
 */
export function monthsSince(isoDate: string | null): number {
  if (!isoDate) return 0;
  const start = new Date(isoDate + "T00:00:00");
  if (Number.isNaN(start.getTime())) return 0;
  const now = new Date();
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  if (now.getDate() >= start.getDate()) months += 1;
  return Math.max(1, months);
}

/**
 * The day a subscription would start charging for the figures on screen.
 *
 * Whichever of the two comes later: there is nothing to pay before the first
 * dictation, and nothing in the window before the window opens.
 */
export function billingStart(summary: {
  firstDay: string | null;
  periodStart: string | null;
}): string | null {
  const { firstDay, periodStart } = summary;
  if (!firstDay) return null;
  if (!periodStart) return firstDay;
  return periodStart > firstDay ? periodStart : firstDay;
}

/** "March 2026", in whatever locale the system is set to. */
export function formatMonth(isoDate: string | null): string {
  if (!isoDate) return "";
  const d = new Date(isoDate + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(UI_LOCALE, { month: "long", year: "numeric" });
}

export const TYPING_SENTENCES = [
  "Productivity is the art of doing more with less effort.",
  "Every minute saved is a minute put back into making something.",
  "A tool should amplify what you can do, not stand in for it.",
  "A good tool disappears in the hands of whoever has mastered it.",
  "Time is the one resource nobody gets back.",
  "Automating the repetitive parts leaves room for the rest.",
  "Speech is the most natural way people have of saying anything.",
  "Writing at the speed you talk changes what you bother to write.",
];

export function getRandomSentence(): string {
  return TYPING_SENTENCES[Math.floor(Math.random() * TYPING_SENTENCES.length)];
}

export function calculateWpm(charCount: number, elapsedMs: number): number {
  const words = charCount / 5;
  const minutes = elapsedMs / 60000;
  return minutes > 0 ? Math.round(words / minutes) : 0;
}

const WPM_STORAGE_KEY = "talk-user-wpm";

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
