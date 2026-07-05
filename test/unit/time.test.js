import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNextTime, formatDuration, timezoneOffsetMinutes, TimeParseError } from '../../src/shared/time.js';

// Saturday 2026-07-04 10:00 UTC.
const REF = Date.parse('2026-07-04T10:00:00Z');
const TZ = 'UTC';

function parsed(input, timezone = TZ) {
  return new Date(parseNextTime(input, timezone, REF)).toISOString();
}

test('parses a plain time later today', () => {
  assert.equal(parsed('23:50'), '2026-07-04T23:50:00.000Z');
});

test('rolls a past plain time over to tomorrow', () => {
  assert.equal(parsed('09:00'), '2026-07-05T09:00:00.000Z');
});

test('parses "tomorrow 23:50"', () => {
  assert.equal(parsed('tomorrow 23:50'), '2026-07-05T23:50:00.000Z');
});

test('parses "in 2 hours"', () => {
  assert.equal(parsed('in 2 hours'), '2026-07-04T12:00:00.000Z');
});

test('parses "next monday 21:00"', () => {
  assert.equal(parsed('next monday 21:00'), '2026-07-06T21:00:00.000Z');
});

test('parses 12-hour formats', () => {
  assert.equal(parsed('11pm'), '2026-07-04T23:00:00.000Z');
  assert.equal(parsed('11:50 PM'), '2026-07-04T23:50:00.000Z');
});

test('parses "today 18:00"', () => {
  assert.equal(parsed('today 18:00'), '2026-07-04T18:00:00.000Z');
});

test('parses French formats via fallback locale', () => {
  assert.equal(parsed('23h50'), '2026-07-04T23:50:00.000Z');
  assert.equal(parsed('demain 23h50'), '2026-07-05T23:50:00.000Z');
});

test('interprets times in the configured timezone', () => {
  // 23:50 in Paris (UTC+2 in July) is 21:50 UTC.
  assert.equal(parsed('23:50', 'Europe/Paris'), '2026-07-04T21:50:00.000Z');
  // 23:50 in New York (UTC-4 in July) is 03:50 UTC the next day.
  assert.equal(parsed('23:50', 'America/New_York'), '2026-07-05T03:50:00.000Z');
});

test('timezone offsets follow daylight saving time', () => {
  assert.equal(timezoneOffsetMinutes('Europe/Paris', REF), 120); // summer
  assert.equal(timezoneOffsetMinutes('Europe/Paris', Date.parse('2026-01-15T10:00:00Z')), 60); // winter
  assert.equal(timezoneOffsetMinutes('Asia/Kolkata', REF), 330); // half-hour offset
  assert.equal(timezoneOffsetMinutes('UTC', REF), 0);
  assert.equal(timezoneOffsetMinutes('Not/A_Zone', REF), 0); // safe fallback
});

test('rejects unparseable input', () => {
  assert.throws(() => parseNextTime('not a time', TZ, REF), TimeParseError);
  assert.throws(() => parseNextTime('', TZ, REF), TimeParseError);
});

test('rejects explicit past dates', () => {
  assert.throws(() => parseNextTime('2020-01-01 10:00', TZ, REF), TimeParseError);
});

test('formats durations as HH:MM:SS', () => {
  assert.equal(formatDuration(0), '00:00:00');
  assert.equal(formatDuration(3 * 3600 * 1000 + 14 * 60 * 1000 + 52 * 1000), '03:14:52');
});
