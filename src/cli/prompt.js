import readline from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';

/**
 * Line-based prompter that also works with piped stdin: lines arriving
 * before a question is asked are buffered, and EOF resolves pending
 * questions with null instead of throwing.
 */
export function createPrompter() {
  const rl = readline.createInterface({ input, output, terminal: input.isTTY === true });
  const buffered = [];
  const waiters = [];
  let closed = false;

  rl.on('line', (line) => {
    const waiter = waiters.shift();
    if (waiter) waiter(line);
    else buffered.push(line);
  });

  rl.on('close', () => {
    closed = true;
    for (const waiter of waiters.splice(0)) waiter(null);
  });

  return {
    /** Ask a question. Resolves with the answer, or null on EOF. */
    question(text) {
      output.write(text);
      if (buffered.length > 0) return Promise.resolve(buffered.shift());
      if (closed) return Promise.resolve(null);
      return new Promise((resolve) => waiters.push(resolve));
    },
    close() {
      rl.close();
    }
  };
}
