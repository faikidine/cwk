export const HOURS = 60 * 60 * 1000;

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

export function parseNextTime(input, timezone, referenceMs = Date.now()) {
  const raw = String(input).trim().toLowerCase();
  const relative = raw.match(/^in\s+(\d+)\s*(h|hour|hours)$/);
  if (relative) return referenceMs + Number(relative[1]) * HOURS;

  const cleaned = raw.replace('today ', '').replace('tomorrow ', '');
  const isTomorrow = raw.startsWith('tomorrow ');
  const match = cleaned.match(/^(\d{1,2})(?::|h)?(\d{2})?\s*(am|pm)?$/);
  if (!match) throw new Error(`Invalid time: ${input}`);

  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3];

  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) throw new Error(`Invalid time: ${input}`);

  // Minimal v1 approximation: local machine timezone is used by Date.
  // Full timezone parsing will be implemented in the engine later.
  const d = new Date(referenceMs);
  d.setHours(hour, minute, 0, 0);
  if (isTomorrow || d.getTime() <= referenceMs) d.setDate(d.getDate() + 1);
  return d.getTime();
}
