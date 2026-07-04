export function getSynchronizationDecision({ now, lastSuccessfulPing, intervalHours }) {
  const intervalMs = intervalHours * 60 * 60 * 1000;
  const elapsedMs = now - lastSuccessfulPing;

  if (elapsedMs >= intervalMs) {
    return { action: 'PING', elapsedMs, remainingMs: 0 };
  }

  return { action: 'WAIT', elapsedMs, remainingMs: intervalMs - elapsedMs };
}
