import { spawn } from 'node:child_process';
import { ok, err } from '../../shared/result.js';

export class ClaudeCliClient {
  async ping({ prompt, model }) {
    return new Promise((resolve) => {
      const child = spawn('claude', ['-p', prompt, '--model', model, '--no-session-persistence'], {
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let output = '';
      child.stdout.on('data', (d) => { output += d.toString(); });
      child.stderr.on('data', (d) => { output += d.toString(); });

      child.on('error', (error) => {
        resolve(err('CLAUDE_CLI_ERROR', 'Claude CLI could not be executed.', error.message));
      });

      child.on('close', (code) => {
        if (code === 0) return resolve(ok({ status: 'success', output }));
        if (/rate limit|usage limit|429|too many requests/i.test(output)) {
          return resolve(ok({ status: 'rate_limited', output }));
        }
        if (/expired|unauthorized|invalid token|authentication|login required|oauth/i.test(output)) {
          return resolve(err('CLAUDE_AUTH_FAILED', 'Claude authentication failed.', output));
        }
        return resolve(err('CLAUDE_UNEXPECTED_ERROR', 'Claude returned an unexpected error.', output));
      });
    });
  }
}
