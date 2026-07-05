const HOUR_MS = 60 * 60 * 1000;

/**
 * The single scheduling rule of CWK.
 *
 * Given the last successful ping, the configured interval and the
 * configured patience, decide what should happen now:
 *
 *   PING            the ping is due
 *   WAIT_THEN_PING  the ping is due within the patience window; the
 *                   caller should wait remainingMs, then synchronize
 *                   again so the ping lands exactly on schedule
 *   WAIT            nothing to do for a while
 *
 * Patience exists because runtimes wake CWK at approximate times:
 * without it, waking up two minutes early would delay the ping until
 * the next wake-up.
 */
export function getSynchronizationDecision({ now, lastSuccessfulPing, intervalHours, patienceMs = 0 }) {
  const intervalMs = intervalHours * HOUR_MS;
  const nextPingMs = lastSuccessfulPing + intervalMs;
  const elapsedMs = now - lastSuccessfulPing;
  const remainingMs = nextPingMs - now;

  if (remainingMs <= 0) {
    return { action: 'PING', elapsedMs, remainingMs: 0, nextPingMs };
  }
  if (remainingMs <= patienceMs) {
    return { action: 'WAIT_THEN_PING', elapsedMs, remainingMs, nextPingMs };
  }
  return { action: 'WAIT', elapsedMs, remainingMs, nextPingMs };
}

/**
 * Compute the initial state from the user's answer to
 * "When should the NEXT ping happen?".
 *
 * The user never provides the previous ping: it is derived so that the
 * next ping lands exactly at the requested time.
 */
export function computeInitialState({ nextPingMs, intervalHours }) {
  return { lastSuccessfulPing: nextPingMs - intervalHours * HOUR_MS };
}
