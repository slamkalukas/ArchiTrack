/**
 * Small date/formatting helpers shared by the WP-2 component inventory
 * (TaskCard due-date chips, FileTable expiry warnings, ChatThread day separators).
 * Kept pure and framework-free so they're easy to unit test.
 */

/** True when `dueDate` is in the past relative to `now` (defaults to real time). */
export function isOverdue(dueDate?: string | null, now: Date = new Date()): boolean {
  if (!dueDate) return false;
  return new Date(dueDate).getTime() < now.getTime();
}

/** True when `validUntil` falls within the next 30 days (but hasn't already passed). */
export function isExpiringSoon(validUntil?: string | null, now: Date = new Date()): boolean {
  if (!validUntil) return false;
  const days = (new Date(validUntil).getTime() - now.getTime()) / 86_400_000;
  return days >= 0 && days < 30;
}

/** Calendar-day key (ignores time) used to decide whether to render a day separator. */
export function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}
