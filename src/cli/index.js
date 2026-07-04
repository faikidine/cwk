#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { createCWK } from '../facade/cwk.js';
import { detectTimezone, parseNextTime, formatLocal, HOURS } from '../shared/time.js';
import { createGitHubActionsWorkflow } from '../adapters/github/workflow.js';

const command = process.argv[2] || 'help';

async function main() {
  if (command === 'init') return init();
  if (command === 'status') return status();
  if (command === 'ping') return ping();
  if (command === 'doctor') return doctor();
  if (command === 'reset') return reset();
  return help();
}

async function init() {
  const cwd = process.cwd();
  const timezone = detectTimezone();
  const rl = readline.createInterface({ input, output });
  const nextInput = await rl.question('When should the NEXT ping happen?\n> ');
  const nextPing = parseNextTime(nextInput, timezone);
  const intervalHours = 5;
  const lastSuccessfulPing = nextPing - intervalHours * HOURS;

  console.log('\nCWK Setup Plan\n');
  console.log(`Timezone: ${timezone}`);
  console.log(`Runtime: GitHub Actions`);
  console.log(`Interval: ${intervalHours} hours`);
  console.log(`Next ping: ${formatLocal(nextPing, timezone)}`);
  console.log(`Computed last ping: ${formatLocal(lastSuccessfulPing, timezone)}`);
  console.log('\nFiles to create:');
  console.log('- .cwk/metadata.json');
  console.log('- .cwk/config.json');
  console.log('- .cwk/state.json');
  console.log('- .github/workflows/cwk.yml');
  console.log('\nRequired GitHub Secret: CLAUDE_OAUTH_TOKEN');

  const confirm = await rl.question('\nContinue? (Y/n) ');
  rl.close();
  if (/^n/i.test(confirm.trim())) return console.log('Aborted.');

  await fs.mkdir(path.join(cwd, '.cwk'), { recursive: true });
  await fs.mkdir(path.join(cwd, '.github/workflows'), { recursive: true });
  await fs.writeFile(path.join(cwd, '.cwk/metadata.json'), JSON.stringify({ formatVersion: 1, createdAt: new Date().toISOString(), cwkVersion: '0.1.0' }, null, 2) + '\n');
  await fs.writeFile(path.join(cwd, '.cwk/config.json'), JSON.stringify({ runtime: 'github-actions', intervalHours, timezone, model: 'haiku', prompt: '.' }, null, 2) + '\n');
  await fs.writeFile(path.join(cwd, '.cwk/state.json'), JSON.stringify({ lastSuccessfulPing, updatedAt: Date.now() }, null, 2) + '\n');
  await fs.writeFile(path.join(cwd, '.github/workflows/cwk.yml'), createGitHubActionsWorkflow());
  console.log('\nCWK initialized. Add GitHub Secret CLAUDE_OAUTH_TOKEN, commit, and push.');
}

async function status() {
  const cwk = createCWK();
  const result = await cwk.status();
  if (!result.ok) return fail(result.error);
  const { config, state, decision } = result.value;
  console.log('CWK Status\n');
  console.log(`Runtime: ${config.runtime}`);
  console.log(`Timezone: ${config.timezone}`);
  console.log(`Last ping: ${formatLocal(state.lastSuccessfulPing, config.timezone)}`);
  console.log(`Decision: ${decision.action}`);
  console.log(`Remaining: ${Math.ceil(decision.remainingMs / 60000)} minutes`);
}

async function ping() {
  const cwk = createCWK();
  const result = await cwk.synchronize({ force: process.argv.includes('--force') });
  if (!result.ok) return fail(result.error);
  console.log(result.value.action === 'PING' ? 'Synchronization completed successfully.' : 'No synchronization required.');
}

async function doctor() {
  const cwk = createCWK();
  const result = await cwk.status();
  if (!result.ok) return fail(result.error);
  console.log('CWK Doctor\n✓ Project\n✓ Configuration\n✓ State\n✓ Workflow assumed present');
}

async function reset() {
  const rl = readline.createInterface({ input, output });
  const confirm = await rl.question('This will remove .cwk/. Continue? (y/N) ');
  rl.close();
  if (!/^y/i.test(confirm.trim())) return console.log('Aborted.');
  await fs.rm(path.join(process.cwd(), '.cwk'), { recursive: true, force: true });
  console.log('CWK project reset.');
}

function help() {
  console.log('CWK\n\nCommands:\n  init\n  status\n  ping [--force]\n  doctor\n  reset');
}

function fail(error) {
  console.error(`${error.code}: ${error.message}`);
  if (error.details) console.error(error.details);
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 4;
});
