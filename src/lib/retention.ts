/**
 * What the history can be told to keep.
 *
 * Zero is not offered any more, but it is still honoured everywhere below and
 * in the Rust that prunes: it means unlimited, which is what the application
 * did for its whole life before this setting existed, and a settings file
 * written while the option existed still carries it.
 */
export const RETENTION_OPTIONS = [
  { value: 50, label: "50" },
  { value: 100, label: "100" },
  { value: 250, label: "250" },
  { value: 500, label: "500" },
] as const;

/**
 * How many transcriptions a new limit would delete.
 *
 * Zero means nothing goes, and nothing going is what tells the page to apply
 * the choice straight away rather than stopping to ask. Raising the limit or
 * picking Everything deletes nothing and should not raise a warning: a dialog
 * that appears when there is no consequence teaches the reader to dismiss it
 * without reading.
 */
export function retentionWouldDelete(count: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.max(0, count - limit);
}
