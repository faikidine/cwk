import * as chrono from 'chrono-node';

export const MINUTES = 60 * 1000;
export const HOURS = 60 * MINUTES;

export function nowMs() {
  return Date.now();
}

export function detectTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function formatLocal(ms, timezone) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(ms));
}

export function formatDuration(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export class TimeParseError extends Error {
  constructor(input, reason) {
    super(`Could not interpret "${input}" as a future time${reason ? `: ${reason}` : '.'}`);
    this.name = 'TimeParseError';
    this.input = input;
  }
}

/**
 * Offset of an IANA timezone, in minutes, at a given instant.
 * chrono-node silently ignores IANA names in its parsing reference and
 * falls back to the system timezone; it only honors numeric offsets.
 */
export function timezoneOffsetMinutes(timezone, atMs) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset' })
      .formatToParts(new Date(atMs));
    const name = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
    const match = name.match(/GMT([+-])(\d{2}):(\d{2})/);
    if (!match) return 0; // plain "GMT" means UTC
    const sign = match[1] === '-' ? -1 : 1;
    return sign * (Number(match[2]) * 60 + Number(match[3]));
  } catch {
    return 0; // unknown timezone: behave as UTC rather than crashing
  }
}

/**
 * Parse a human time expression into an absolute timestamp (ms).
 *
 * Accepts natural language via chrono-node, e.g.:
 *   "23:50", "11pm", "11:50 PM", "today 23:50", "tomorrow 18:00",
 *   "in 2 hours", "next monday 21:00", "23h50", "demain 23h50".
 *
 * The result is always strictly in the future relative to `referenceMs`.
 * Time-only inputs that already passed today roll over to tomorrow.
 */
export function parseNextTime(input, timezone, referenceMs = Date.now()) {
  const raw = String(input ?? '').trim();
  if (!raw) throw new TimeParseError(input, 'empty input');

  const reference = {
    instant: new Date(referenceMs),
    timezone: timezoneOffsetMinutes(timezone, referenceMs)
  };
  const options = { forwardDate: true };

  let results = chrono.parse(raw, reference, options);
  if (results.length === 0) results = chrono.fr.parse(raw, reference, options);
  if (results.length === 0) throw new TimeParseError(raw);

  const result = results[0];
  let ms = result.date().getTime();

  // forwardDate usually handles this, but roll time-only inputs that
  // still resolve to a past instant over to the next day.
  if (ms <= referenceMs && !result.start.isCertain('day')) ms += 24 * HOURS;
  if (ms <= referenceMs) throw new TimeParseError(raw, 'it resolves to a past time');

  return ms;
}
