import { CWKEngine } from '../engine/core.js';
import { FileSystemStateStore } from '../adapters/filesystem/state-store.js';
import { ClaudeCliClient } from '../adapters/claude/claude-cli-client.js';

export function createCWK({ cwd = process.cwd(), clock = { now: () => Date.now() } } = {}) {
  const stateStore = new FileSystemStateStore({ cwd });
  const claudeClient = new ClaudeCliClient();
  return new CWKEngine({ stateStore, claudeClient, clock });
}
