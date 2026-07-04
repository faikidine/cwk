const HOUR_MS = 60 * 60 * 1000;

/**
 * The single scheduling rule of CWK.
 *
 * Given the last successful ping and the configured interval, decide
 * whether a ping is due now. Returns PING or WAIT, nothing else.
 */
export function getSynchronizationDecision({ now, lastSuccessfulPing, intervalHours }) {
  const intervalMs = intervalHours * HOUR_MS;
  const nextPingMs = lastSuccessfulPing + intervalMs;
  const elapsedMs = now - lastSuccessfulPing;

  if (now >= nextPingMs) {
    return { action: 'PING', elapsedMs, remainingMs: 0, nextPingMs };
  }

  return { action: 'WAIT', elapsedMs, remainingMs: nextPingMs - now, nextPingMs };
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
