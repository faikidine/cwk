import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createGitHubActionsWorkflow } from '../../src/adapters/github/workflow.js';

const CLI = fileURLToPath(new URL('../../src/cli/index.js', import.meta.url));
const HOUR = 60 * 60 * 1000;

let workRoot;
let fakeBinDir;

before(async () => {
  workRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'cwk-test-'));
  // A fake `claude` binary so integration tests never hit the network.
  fakeBinDir = path.join(workRoot, 'fake-bin');
  await fs.mkdir(fakeBinDir);
  await fs.writeFile(path.join(fakeBinDir, 'claude'), '#!/bin/sh\necho pong\nexit 0\n', { mode: 0o755 });
});

after(async () => {
  await fs.rm(workRoot, { recursive: true, force: true });
});

function runCli(args, { cwd, stdinText = '', env = {} } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      cwd,
      env: { ...process.env, PATH: `${fakeBinDir}:${process.env.PATH}`, ...env },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(stdinText);
  });
}

async function makeRepo(name) {
  const dir = path.join(workRoot, name);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function writeProject(dir, { lastSuccessfulPing }) {
  await fs.mkdir(path.join(dir, '.cwk'), { recursive: true });
  await fs.mkdir(path.join(dir, '.github/workflows'), { recursive: true });
  await fs.writeFile(path.join(dir, '.cwk/metadata.json'), JSON.stringify({
    formatVersion: 1, createdAt: new Date().toISOString(), cwkVersion: '0.1.0'
  }));
  await fs.writeFile(path.join(dir, '.cwk/config.json'), JSON.stringify({
    runtime: 'github-actions', intervalHours: 5, timezone: 'UTC', model: 'haiku', prompt: '.'
  }));
  await fs.writeFile(path.join(dir, '.cwk/state.json'), JSON.stringify({ lastSuccessfulPing }));
  await fs.writeFile(path.join(dir, '.github/workflows/cwk.yml'), createGitHubActionsWorkflow({ cronMinute: 50 }));
}

test('init creates the project after confirmation', async () => {
  const dir = await makeRepo('init-yes');
  const result = await runCli(['init'], { cwd: dir, stdinText: 'tomorrow 23:50\ny\n' });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /CWK Setup Plan/);
  assert.match(result.stdout, /CLAUDE_OAUTH_TOKEN/);

  const config = JSON.parse(await fs.readFile(path.join(dir, '.cwk/config.json'), 'utf8'));
  assert.equal(config.runtime, 'github-actions');
  assert.equal(config.intervalHours, 5);

  const state = JSON.parse(await fs.readFile(path.join(dir, '.cwk/state.json'), 'utf8'));
  assert.equal(typeof state.lastSuccessfulPing, 'number');

  const workflow = await fs.readFile(path.join(dir, '.github/workflows/cwk.yml'), 'utf8');
  // The cron minute is aligned with the requested ping time (in UTC).
  assert.match(workflow, /cron: '\d{1,2} \* \* \* \*'/);
  assert.match(workflow, /cwk ping/);
});

test('init writes nothing when the user declines', async () => {
  const dir = await makeRepo('init-no');
  const result = await runCli(['init'], { cwd: dir, stdinText: '23:50\nn\n' });

  assert.equal(result.code, 0);
  assert.match(result.stdout, /Aborted/);
  await assert.rejects(fs.access(path.join(dir, '.cwk')));
});

test('init re-asks on invalid time input', async () => {
  const dir = await makeRepo('init-retry');
  const result = await runCli(['init'], { cwd: dir, stdinText: 'garbage input\n23:50\nn\n' });

  assert.equal(result.code, 0);
  assert.match(result.stdout, /try again/i);
  assert.match(result.stdout, /CWK Setup Plan/);
});

test('init refuses an already initialized project', async () => {
  const dir = await makeRepo('init-twice');
  await writeProject(dir, { lastSuccessfulPing: Date.now() });
  const result = await runCli(['init'], { cwd: dir, stdinText: '23:50\ny\n' });

  assert.equal(result.code, 2);
  assert.match(result.stderr, /already exists/);
});

test('status reports the project on stdout and as JSON', async () => {
  const dir = await makeRepo('status');
  await writeProject(dir, { lastSuccessfulPing: Date.now() - 2 * HOUR });

  const human = await runCli(['status'], { cwd: dir });
  assert.equal(human.code, 0, human.stderr);
  assert.match(human.stdout, /✓ Initialized/);
  assert.match(human.stdout, /Remaining/);

  const json = await runCli(['status', '--json'], { cwd: dir });
  const parsed = JSON.parse(json.stdout);
  assert.equal(parsed.decision.action, 'WAIT');
});

test('status fails with exit code 2 when uninitialized', async () => {
  const dir = await makeRepo('status-none');
  const result = await runCli(['status'], { cwd: dir });

  assert.equal(result.code, 2);
  assert.match(result.stderr, /cwk init/);
});

test('ping waits when not due', async () => {
  const dir = await makeRepo('ping-wait');
  await writeProject(dir, { lastSuccessfulPing: Date.now() });
  const result = await runCli(['ping'], { cwd: dir });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /No synchronization required/);
});

test('ping contacts claude and updates state when due', async () => {
  const dir = await makeRepo('ping-due');
  const oldPing = Date.now() - 6 * HOUR;
  await writeProject(dir, { lastSuccessfulPing: oldPing });
  const result = await runCli(['ping'], { cwd: dir });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Synchronization completed successfully/);

  const state = JSON.parse(await fs.readFile(path.join(dir, '.cwk/state.json'), 'utf8'));
  assert.ok(state.lastSuccessfulPing > oldPing);
});

test('ping --force pings even when not due', async () => {
  const dir = await makeRepo('ping-force');
  await writeProject(dir, { lastSuccessfulPing: Date.now() });
  const result = await runCli(['ping', '--force'], { cwd: dir });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Synchronization completed successfully/);
});

test('ping fails with exit code 3 when claude fails', async () => {
  const dir = await makeRepo('ping-fail');
  await writeProject(dir, { lastSuccessfulPing: Date.now() - 6 * HOUR });

  const failBin = path.join(workRoot, 'fail-bin');
  await fs.mkdir(failBin, { recursive: true });
  await fs.writeFile(path.join(failBin, 'claude'), '#!/bin/sh\necho "invalid token" >&2\nexit 1\n', { mode: 0o755 });

  const result = await runCli(['ping'], { cwd: dir, env: { PATH: `${failBin}:${process.env.PATH}` } });
  assert.equal(result.code, 3);
  assert.match(result.stderr, /authentication/i);

  const state = JSON.parse(await fs.readFile(path.join(dir, '.cwk/state.json'), 'utf8'));
  assert.equal(state.lastSuccessfulPing < Date.now() - 5 * HOUR, true);
});

test('doctor passes on a healthy project and flags a missing workflow', async () => {
  const dir = await makeRepo('doctor');
  await writeProject(dir, { lastSuccessfulPing: Date.now() });

  const healthy = await runCli(['doctor'], { cwd: dir });
  assert.equal(healthy.code, 0, healthy.stderr);
  assert.match(healthy.stdout, /Everything looks good/);

  await fs.rm(path.join(dir, '.github/workflows/cwk.yml'));
  const broken = await runCli(['doctor'], { cwd: dir });
  assert.equal(broken.code, 2);
  assert.match(broken.stdout, /✗ Runtime/);
});

test('repair reports nothing to do on a healthy project', async () => {
  const dir = await makeRepo('repair-healthy');
  await writeProject(dir, { lastSuccessfulPing: Date.now() });
  const result = await runCli(['repair'], { cwd: dir });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Nothing to repair/);
});

test('repair regenerates a missing workflow and doctor passes again', async () => {
  const dir = await makeRepo('repair-workflow');
  await writeProject(dir, { lastSuccessfulPing: Date.now() });
  await fs.rm(path.join(dir, '.github/workflows/cwk.yml'));

  const result = await runCli(['repair'], { cwd: dir });
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /workflow.*is missing/i);
  assert.match(result.stdout, /Regenerated \.github\/workflows\/cwk\.yml/);

  const doctor = await runCli(['doctor'], { cwd: dir });
  assert.equal(doctor.code, 0, doctor.stdout);
});

test('repair fixes a damaged workflow while keeping the cron minute', async () => {
  const dir = await makeRepo('repair-damaged');
  await writeProject(dir, { lastSuccessfulPing: Date.now() });

  // A workflow with a custom minute but missing the step that runs CWK.
  const damaged = createGitHubActionsWorkflow({ cronMinute: 17 })
    .replace('run: cwk ping', 'run: echo nothing');
  await fs.writeFile(path.join(dir, '.github/workflows/cwk.yml'), damaged);

  const result = await runCli(['repair'], { cwd: dir });
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /missing the step that runs cwk ping/);
  assert.match(result.stdout, /kept your schedule minute 17/);

  const repaired = await fs.readFile(path.join(dir, '.github/workflows/cwk.yml'), 'utf8');
  assert.match(repaired, /cron: '17 \* \* \* \*'/);
  assert.match(repaired, /run: cwk ping/);
});

test('repair rebuilds a corrupted config and an invalid state', async () => {
  const dir = await makeRepo('repair-files');
  await writeProject(dir, { lastSuccessfulPing: Date.now() });
  await fs.writeFile(path.join(dir, '.cwk/config.json'), '{ this is not json');
  await fs.writeFile(path.join(dir, '.cwk/state.json'), JSON.stringify({ lastSuccessfulPing: 'unknown' }));

  const result = await runCli(['repair'], { cwd: dir });
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /unreadable JSON/);
  assert.match(result.stdout, /Restarted the schedule/);

  const config = JSON.parse(await fs.readFile(path.join(dir, '.cwk/config.json'), 'utf8'));
  assert.equal(config.intervalHours, 5);
  const state = JSON.parse(await fs.readFile(path.join(dir, '.cwk/state.json'), 'utf8'));
  assert.equal(typeof state.lastSuccessfulPing, 'number');

  const doctor = await runCli(['doctor'], { cwd: dir });
  assert.equal(doctor.code, 0, doctor.stdout);
});

test('repair fails with exit code 2 when there is no project', async () => {
  const dir = await makeRepo('repair-none');
  const result = await runCli(['repair'], { cwd: dir });

  assert.equal(result.code, 2);
  assert.match(result.stderr, /cwk init/);
});

test('doctor suggests repair when unhealthy', async () => {
  const dir = await makeRepo('doctor-suggests');
  await writeProject(dir, { lastSuccessfulPing: Date.now() });
  await fs.rm(path.join(dir, '.github/workflows/cwk.yml'));

  const result = await runCli(['doctor'], { cwd: dir });
  assert.equal(result.code, 2);
  assert.match(result.stdout, /Run: cwk repair/);
});

test('reset removes the project after confirmation', async () => {
  const dir = await makeRepo('reset');
  await writeProject(dir, { lastSuccessfulPing: Date.now() });
  const result = await runCli(['reset'], { cwd: dir, stdinText: 'y\n' });

  assert.equal(result.code, 0, result.stderr);
  await assert.rejects(fs.access(path.join(dir, '.cwk')));
  await assert.rejects(fs.access(path.join(dir, '.github/workflows/cwk.yml')));
});

test('--version prints the version', async () => {
  const dir = await makeRepo('version');
  const result = await runCli(['--version'], { cwd: dir });
  assert.equal(result.code, 0);
  assert.match(result.stdout.trim(), /^\d+\.\d+\.\d+$/);
});

test('unknown commands show help and fail', async () => {
  const dir = await makeRepo('unknown');
  const result = await runCli(['frobnicate'], { cwd: dir });
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Unknown command/);
});
