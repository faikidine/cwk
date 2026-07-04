import { spawn } from 'node:child_process';
import { ok, err } from '../../shared/result.js';

const PING_TIMEOUT_MS = 120_000;

export class ClaudeCliClient {
  constructor({ command = 'claude', timeoutMs = PING_TIMEOUT_MS } = {}) {
    this.command = command;
    this.timeoutMs = timeoutMs;
  }

  async ping({ prompt, model }) {
    return new Promise((resolve) => {
      const child = spawn(this.command, ['-p', prompt, '--model', model], {
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let output = '';
      let settled = false;
      const settle = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      };

      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        settle(err('CLAUDE_TIMEOUT', `Claude did not answer within ${this.timeoutMs / 1000}s.`, output));
      }, this.timeoutMs);

      child.stdout.on('data', (d) => { output += d.toString(); });
      child.stderr.on('data', (d) => { output += d.toString(); });

      child.on('error', (error) => {
        settle(err('CLAUDE_CLI_ERROR', 'Claude CLI could not be executed. Is Claude Code installed?', error.message));
      });

      child.on('close', (code) => {
        if (code === 0) return settle(ok({ status: 'success', output }));
        // Hitting the rate limit still counts as contact: the usage
        // window is already open, which is exactly what CWK wants.
        if (/rate limit|usage limit|429|too many requests/i.test(output)) {
          return settle(ok({ status: 'rate_limited', output }));
        }
        if (/expired|unauthorized|invalid token|authentication|login required|oauth/i.test(output)) {
          return settle(err('CLAUDE_AUTH_FAILED', 'Claude authentication failed. Check your token.', output));
        }
        settle(err('CLAUDE_UNEXPECTED_ERROR', 'Claude returned an unexpected error.', output));
      });
    });
  }
}
