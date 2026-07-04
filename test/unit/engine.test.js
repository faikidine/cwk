import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CWKEngine, validateProject, FORMAT_VERSION } from '../../src/engine/core.js';
import { ok, err } from '../../src/shared/result.js';

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse('2026-07-04T10:00:00Z');

function makeProject(overrides = {}) {
  return {
    metadata: { formatVersion: FORMAT_VERSION, createdAt: '2026-07-01T00:00:00Z', cwkVersion: '0.1.0' },
    config: { runtime: 'github-actions', intervalHours: 5, timezone: 'UTC', model: 'haiku', prompt: '.' },
    state: { lastSuccessfulPing: NOW - 6 * HOUR, updatedAt: NOW - 6 * HOUR },
    ...overrides
  };
}

function makeFakes({ exists = true, project = makeProject(), pingResult = ok({ status: 'success', output: '' }) } = {}) {
  const calls = { pings: 0, savedStates: [], written: [], installed: [], removed: 0, uninstalled: 0 };
  const engine = new CWKEngine({
    stateStore: {
      projectExists: async () => exists,
      loadProject: async () => (exists ? ok(project) : err('PROJECT_NOT_INITIALIZED', 'CWK project not initialized. Run: cwk init')),
      writeProject: async (plan) => { calls.written.push(plan); return ok(); },
      saveState: async (state) => { calls.savedStates.push(state); return ok(); },
      removeProject: async () => { calls.removed += 1; return ok(); }
    },
    claudeClient: {
      ping: async () => { calls.pings += 1; return pingResult; }
    },
    runtime: {
      name: 'github-actions',
      plan: ({ nextPingMs }) => ({
        name: 'github-actions',
        cronMinute: new Date(nextPingMs).getUTCMinutes(),
        files: ['.github/workflows/cwk.yml'],
        requirements: ['GitHub Secret: CLAUDE_OAUTH_TOKEN']
      }),
      install: async (plan) => { calls.installed.push(plan); return ok(); },
      validate: async () => ok(),
      uninstall: async () => { calls.uninstalled += 1; return ok(); }
    },
    clock: { now: () => NOW },
    cwkVersion: '0.1.0'
  });
  return { engine, calls };
}

test('initialize returns a plan without writing anything', async () => {
  const { engine, calls } = makeFakes({ exists: false });
  const result = await engine.initialize({ nextPingMs: NOW + 3 * HOUR, timezone: 'Europe/Paris' });

  assert.equal(result.ok, true);
  const { plan } = result.value;
  assert.equal(plan.state.lastSuccessfulPing, NOW + 3 * HOUR - 5 * HOUR);
  assert.equal(plan.config.timezone, 'Europe/Paris');
  assert.equal(plan.metadata.formatVersion, FORMAT_VERSION);
  assert.deepEqual(plan.files, [
    '.cwk/metadata.json',
    '.cwk/config.json',
    '.cwk/state.json',
    '.github/workflows/cwk.yml'
  ]);
  assert.equal(calls.written.length, 0);
  assert.equal(calls.installed.length, 0);
});

test('initialize refuses an existing project', async () => {
  const { engine } = makeFakes({ exists: true });
  const result = await engine.initialize({ nextPingMs: NOW + HOUR, timezone: 'UTC' });
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'PROJECT_ALREADY_INITIALIZED');
});

test('initialize validates its inputs', async () => {
  const { engine } = makeFakes({ exists: false });
  assert.equal((await engine.initialize({ timezone: 'UTC' })).error.code, 'INVALID_NEXT_PING');
  assert.equal((await engine.initialize({ nextPingMs: NOW, timezone: 'UTC', intervalHours: 0 })).error.code, 'INVALID_INTERVAL');
  assert.equal((await engine.initialize({ nextPingMs: NOW })).error.code, 'INVALID_TIMEZONE');
});

test('applyInitialization writes the project and installs the runtime', async () => {
  const { engine, calls } = makeFakes({ exists: false });
  const { value: { plan } } = await engine.initialize({ nextPingMs: NOW + HOUR, timezone: 'UTC' });
  const applied = await engine.applyInitialization(plan);

  assert.equal(applied.ok, true);
  assert.equal(calls.written.length, 1);
  assert.equal(calls.installed.length, 1);
});

test('synchronize pings and persists state when due', async () => {
  const { engine, calls } = makeFakes();
  const result = await engine.synchronize();

  assert.equal(result.ok, true);
  assert.equal(result.value.action, 'PING');
  assert.equal(calls.pings, 1);
  assert.equal(calls.savedStates.length, 1);
  assert.equal(calls.savedStates[0].lastSuccessfulPing, NOW);
});

test('synchronize waits without contacting Claude when not due', async () => {
  const project = makeProject({ state: { lastSuccessfulPing: NOW - 2 * HOUR } });
  const { engine, calls } = makeFakes({ project });
  const result = await engine.synchronize();

  assert.equal(result.value.action, 'WAIT');
  assert.equal(calls.pings, 0);
  assert.equal(calls.savedStates.length, 0);
});

test('synchronize --force pings even when not due', async () => {
  const project = makeProject({ state: { lastSuccessfulPing: NOW - 2 * HOUR } });
  const { engine, calls } = makeFakes({ project });
  const result = await engine.synchronize({ force: true });

  assert.equal(result.value.action, 'PING');
  assert.equal(calls.pings, 1);
});

test('a rate-limited ping still counts as successful contact', async () => {
  const { engine, calls } = makeFakes({ pingResult: ok({ status: 'rate_limited', output: '' }) });
  const result = await engine.synchronize();

  assert.equal(result.ok, true);
  assert.equal(result.value.action, 'PING');
  assert.equal(calls.savedStates.length, 1);
});

test('a failed ping does not update state', async () => {
  const { engine, calls } = makeFakes({ pingResult: err('CLAUDE_AUTH_FAILED', 'Claude authentication failed.') });
  const result = await engine.synchronize();

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'CLAUDE_AUTH_FAILED');
  assert.equal(calls.savedStates.length, 0);
});

test('status reports the scheduling decision', async () => {
  const { engine } = makeFakes();
  const result = await engine.status();

  assert.equal(result.ok, true);
  assert.equal(result.value.decision.action, 'PING');
  assert.equal(result.value.decision.nextPingMs, NOW - HOUR);
});

test('operations fail cleanly on an uninitialized project', async () => {
  const { engine } = makeFakes({ exists: false });
  assert.equal((await engine.status()).error.code, 'PROJECT_NOT_INITIALIZED');
  assert.equal((await engine.synchronize()).error.code, 'PROJECT_NOT_INITIALIZED');
  assert.equal((await engine.reset()).error.code, 'PROJECT_NOT_INITIALIZED');
});

test('operations fail cleanly on an invalid project', async () => {
  const project = makeProject({ state: { lastSuccessfulPing: 'not-a-number' } });
  const { engine } = makeFakes({ project });
  const result = await engine.synchronize();

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'PROJECT_INVALID');
});

test('doctor reports healthy on a valid project', async () => {
  const { engine } = makeFakes();
  const result = await engine.doctor();

  assert.equal(result.ok, true);
  assert.equal(result.value.healthy, true);
});

test('doctor reports the missing project with a fix', async () => {
  const { engine } = makeFakes({ exists: false });
  const result = await engine.doctor();

  assert.equal(result.value.healthy, false);
  const projectCheck = result.value.checks.find((c) => c.name === 'Project');
  assert.match(projectCheck.message, /cwk init/);
});

test('reset removes the project and uninstalls the runtime', async () => {
  const { engine, calls } = makeFakes();
  const result = await engine.reset();

  assert.equal(result.ok, true);
  assert.equal(calls.removed, 1);
  assert.equal(calls.uninstalled, 1);
});

test('validateProject flags unsupported format versions', () => {
  const project = makeProject({ metadata: { formatVersion: 99 } });
  const issues = validateProject(project);
  assert.match(issues.metadata, /format/i);
});
