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

function partsFromProject(project) {
  return {
    metadata: { status: 'ok', path: '.cwk/metadata.json', value: project.metadata },
    config: { status: 'ok', path: '.cwk/config.json', value: project.config },
    state: { status: 'ok', path: '.cwk/state.json', value: project.state }
  };
}

function makeFakes({
  exists = true,
  project = makeProject(),
  parts,
  diagnosis = { ok: true, problems: [] },
  pingResult = ok({ status: 'success', output: '' })
} = {}) {
  const calls = { pings: 0, savedStates: [], savedParts: [], written: [], installed: [], runtimeRepairs: [], removed: 0, uninstalled: 0 };
  const engine = new CWKEngine({
    stateStore: {
      projectExists: async () => exists,
      loadProject: async () => (exists ? ok(project) : err('PROJECT_NOT_INITIALIZED', 'CWK project not initialized. Run: cwk init')),
      loadParts: async () => parts ?? (exists
        ? partsFromProject(project)
        : { metadata: { status: 'missing', path: '.cwk/metadata.json' }, config: { status: 'missing', path: '.cwk/config.json' }, state: { status: 'missing', path: '.cwk/state.json' } }),
      writeProject: async (plan) => { calls.written.push(plan); return ok(); },
      savePart: async (key, value) => { calls.savedParts.push({ key, value }); return ok(); },
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
      diagnose: async () => diagnosis,
      repair: async ({ nextPingMs }) => { calls.runtimeRepairs.push(nextPingMs); return ok({ action: 'Regenerated the workflow.' }); },
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

test('repair does nothing on a healthy project', async () => {
  const { engine, calls } = makeFakes();
  const result = await engine.repair({ timezone: 'UTC' });

  assert.equal(result.ok, true);
  assert.deepEqual(result.value.repairs, []);
  assert.equal(calls.savedParts.length, 0);
  assert.equal(calls.runtimeRepairs.length, 0);
});

test('repair refuses when no project exists at all', async () => {
  const { engine } = makeFakes({ exists: false });
  const result = await engine.repair({ timezone: 'UTC' });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'PROJECT_NOT_INITIALIZED');
});

test('repair rebuilds a corrupted config with defaults and says so', async () => {
  const project = makeProject();
  const parts = partsFromProject(project);
  parts.config = { status: 'corrupted', path: '.cwk/config.json', detail: 'Unexpected token' };
  const { engine, calls } = makeFakes({ project, parts });

  const result = await engine.repair({ timezone: 'Europe/Paris' });
  assert.equal(result.ok, true);

  const entry = result.value.repairs.find((r) => r.name === 'Configuration');
  assert.match(entry.problem, /unreadable JSON/);
  assert.match(entry.action, /every 5 hours/);

  const saved = calls.savedParts.find((p) => p.key === 'config');
  assert.equal(saved.value.timezone, 'Europe/Paris');
  assert.equal(saved.value.intervalHours, 5);
});

test('repair fixes only the invalid config fields and keeps the rest', async () => {
  const project = makeProject();
  project.config = { ...project.config, intervalHours: -3, model: 'opus' };
  const parts = partsFromProject(project);
  const { engine, calls } = makeFakes({ project, parts });

  const result = await engine.repair({ timezone: 'UTC' });
  const entry = result.value.repairs.find((r) => r.name === 'Configuration');
  assert.match(entry.problem, /intervalHours was invalid/);
  assert.match(entry.action, /preserved/);

  const saved = calls.savedParts.find((p) => p.key === 'config');
  assert.equal(saved.value.intervalHours, 5);
  assert.equal(saved.value.model, 'opus');
  assert.equal(saved.value.timezone, 'UTC');
});

test('repair restarts the schedule when state is unrecoverable', async () => {
  const project = makeProject();
  const parts = partsFromProject(project);
  parts.state = { status: 'missing', path: '.cwk/state.json' };
  const { engine, calls } = makeFakes({ project, parts });

  const result = await engine.repair({ timezone: 'UTC' });
  const entry = result.value.repairs.find((r) => r.name === 'State');
  assert.match(entry.action, /next ping in 5 hours/);
  assert.match(entry.action, /cwk ping --force/);

  const saved = calls.savedParts.find((p) => p.key === 'state');
  assert.equal(saved.value.lastSuccessfulPing, NOW);
});

test('repair normalizes an unsupported format version but keeps metadata', async () => {
  const project = makeProject();
  project.metadata = { ...project.metadata, formatVersion: 99 };
  const parts = partsFromProject(project);
  const { engine, calls } = makeFakes({ project, parts });

  const result = await engine.repair({ timezone: 'UTC' });
  const entry = result.value.repairs.find((r) => r.name === 'Metadata');
  assert.match(entry.problem, /format version 99/);

  const saved = calls.savedParts.find((p) => p.key === 'metadata');
  assert.equal(saved.value.formatVersion, FORMAT_VERSION);
  assert.equal(saved.value.createdAt, project.metadata.createdAt);
});

test('repair delegates runtime problems to the adapter', async () => {
  const diagnosis = { ok: false, problems: ['The workflow is missing the step that runs cwk ping.'] };
  const { engine, calls } = makeFakes({ diagnosis });

  const result = await engine.repair({ timezone: 'UTC' });
  const entry = result.value.repairs.find((r) => r.name === 'Runtime');
  assert.match(entry.problem, /cwk ping/);
  assert.match(entry.action, /Regenerated/);
  assert.equal(calls.runtimeRepairs.length, 1);
});

test('validateProject flags unsupported format versions', () => {
  const project = makeProject({ metadata: { formatVersion: 99 } });
  const issues = validateProject(project);
  assert.match(issues.metadata, /format/i);
});
