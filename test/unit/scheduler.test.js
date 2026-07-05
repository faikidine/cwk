import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSynchronizationDecision, computeInitialState } from '../../src/engine/scheduler.js';

const HOUR = 60 * 60 * 1000;

test('waits while the interval has not elapsed', () => {
  const decision = getSynchronizationDecision({
    now: 4 * HOUR,
    lastSuccessfulPing: 0,
    intervalHours: 5
  });
  assert.equal(decision.action, 'WAIT');
  assert.equal(decision.remainingMs, 1 * HOUR);
  assert.equal(decision.nextPingMs, 5 * HOUR);
});

test('pings exactly when the interval elapses', () => {
  const decision = getSynchronizationDecision({
    now: 5 * HOUR,
    lastSuccessfulPing: 0,
    intervalHours: 5
  });
  assert.equal(decision.action, 'PING');
  assert.equal(decision.remainingMs, 0);
});

test('pings when the interval elapsed long ago (missed runs)', () => {
  const decision = getSynchronizationDecision({
    now: 27 * HOUR,
    lastSuccessfulPing: 0,
    intervalHours: 5
  });
  assert.equal(decision.action, 'PING');
});

test('waits when the last ping is in the future (fresh init)', () => {
  const decision = getSynchronizationDecision({
    now: 0,
    lastSuccessfulPing: 2 * HOUR,
    intervalHours: 5
  });
  assert.equal(decision.action, 'WAIT');
  assert.equal(decision.remainingMs, 7 * HOUR);
});

test('waits-then-pings when the ping is due within the patience window', () => {
  const decision = getSynchronizationDecision({
    now: 5 * HOUR - 2 * 60 * 1000, // 2 minutes before the target
    lastSuccessfulPing: 0,
    intervalHours: 5,
    patienceMs: 25 * 60 * 1000
  });
  assert.equal(decision.action, 'WAIT_THEN_PING');
  assert.equal(decision.remainingMs, 2 * 60 * 1000);
});

test('waits normally when the remaining time exceeds the patience', () => {
  const decision = getSynchronizationDecision({
    now: 4 * HOUR,
    lastSuccessfulPing: 0,
    intervalHours: 5,
    patienceMs: 25 * 60 * 1000
  });
  assert.equal(decision.action, 'WAIT');
});

test('zero patience disables waiting entirely', () => {
  const decision = getSynchronizationDecision({
    now: 5 * HOUR - 1,
    lastSuccessfulPing: 0,
    intervalHours: 5,
    patienceMs: 0
  });
  assert.equal(decision.action, 'WAIT');
});

test('initial state places the next ping at the requested time', () => {
  const nextPingMs = 100 * HOUR;
  const state = computeInitialState({ nextPingMs, intervalHours: 5 });
  assert.equal(state.lastSuccessfulPing, 95 * HOUR);

  const decision = getSynchronizationDecision({
    now: nextPingMs,
    lastSuccessfulPing: state.lastSuccessfulPing,
    intervalHours: 5
  });
  assert.equal(decision.action, 'PING');

  const before = getSynchronizationDecision({
    now: nextPingMs - 1,
    lastSuccessfulPing: state.lastSuccessfulPing,
    intervalHours: 5
  });
  assert.equal(before.action, 'WAIT');
});
