import { createRequire } from 'node:module';
import { CWKEngine } from '../engine/core.js';
import { FileSystemStateStore } from '../adapters/filesystem/state-store.js';
import { ClaudeCliClient } from '../adapters/claude/claude-cli-client.js';
import { GitHubActionsRuntime } from '../adapters/github/runtime.js';

const require = createRequire(import.meta.url);
const pkg = require('../../package.json');

export const CWK_VERSION = pkg.version;

/**
 * The public API of CWK. The CLI (and any future interface) talks only
 * to this facade; adapters are wired here and injected into the engine.
 */
export function createCWK({ cwd = process.cwd(), clock = { now: () => Date.now() } } = {}) {
  const engine = new CWKEngine({
    stateStore: new FileSystemStateStore({ cwd }),
    claudeClient: new ClaudeCliClient(),
    runtime: new GitHubActionsRuntime({ cwd }),
    clock,
    cwkVersion: CWK_VERSION
  });

  return {
    init: (input) => engine.initialize(input),
    applyInit: (plan) => engine.applyInitialization(plan),
    status: () => engine.status(),
    ping: (options) => engine.synchronize(options),
    doctor: () => engine.doctor(),
    repair: (input) => engine.repair(input),
    reset: () => engine.reset()
  };
}
