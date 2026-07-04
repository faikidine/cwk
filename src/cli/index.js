#!/usr/bin/env node
import { createPrompter } from './prompt.js';
import { createCWK, CWK_VERSION } from '../facade/cwk.js';
import {
  detectTimezone,
  parseNextTime,
  formatLocal,
  formatDuration,
  TimeParseError
} from '../shared/time.js';

const EXIT = { OK: 0, USER: 1, PROJECT: 2, RUNTIME: 3, INTERNAL: 4 };

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const command = args.find((a) => !a.startsWith('--')) || 'help';
const asJson = flags.has('--json');
const verbose = flags.has('--verbose');

async function main() {
  if (flags.has('--version')) return console.log(CWK_VERSION);
  if (flags.has('--help') || command === 'help') return help();

  const commands = { init, status, ping, doctor, reset };
  const run = commands[command];
  if (!run) {
    console.error(`Unknown command: ${command}\n`);
    help();
    process.exitCode = EXIT.USER;
    return;
  }
  await run(createCWK());
}

async function init(cwk) {
  const timezone = detectTimezone();
  const rl = createPrompter();

  try {
    console.log('CWK Initialization\n');
    console.log(`Timezone\n✓ ${timezone}\n`);
    console.log('Runtime Adapter\n✓ GitHub Actions\n');

    let nextPingMs;
    while (nextPingMs === undefined) {
      const answer = await rl.question('When should the NEXT ping happen? (e.g. "23:50", "tomorrow 18:00", "in 2 hours")\n> ');
      if (answer === null) return fail({ code: 'NO_INPUT', message: 'No input received. Run cwk init in an interactive terminal.' });
      try {
        nextPingMs = parseNextTime(answer, timezone);
      } catch (error) {
        if (!(error instanceof TimeParseError)) throw error;
        console.log(`\n${error.message}\nPlease try again.\n`);
      }
    }

    const result = await cwk.init({ nextPingMs, timezone });
    if (!result.ok) return fail(result.error);
    const { plan } = result.value;

    console.log('\nCWK Setup Plan\n');
    console.log(`Runtime\n✓ ${plan.runtime.name}\n`);
    console.log(`Timezone\n✓ ${plan.config.timezone}\n`);
    console.log(`Interval\n✓ every ${plan.config.intervalHours} hours\n`);
    console.log(`Next Ping\n✓ ${formatLocal(plan.nextPingMs, plan.config.timezone)}\n`);
    console.log('Files to create\n');
    for (const file of plan.files) console.log(`✓ ${file}`);
    console.log('\nRequired\n');
    for (const requirement of plan.runtime.requirements) console.log(`- ${requirement}`);

    const confirm = await rl.question('\nContinue? (Y/n) ');
    if (confirm === null || /^n/i.test(confirm.trim())) return console.log('Aborted. Nothing was created.');

    const applied = await cwk.applyInit(plan);
    if (!applied.ok) return fail(applied.error);

    console.log('\nCWK initialized.');
    console.log('Next steps: add the GitHub Secret CLAUDE_OAUTH_TOKEN, commit, and push.');
  } finally {
    rl.close();
  }
}

async function status(cwk) {
  const result = await cwk.status();
  if (!result.ok) return fail(result.error);

  const { config, state, decision } = result.value;
  if (asJson) return console.log(JSON.stringify(result.value, null, 2));

  console.log('CWK Status\n');
  console.log('Project\n✓ Initialized\n');
  console.log(`Runtime\n${config.runtime}\n`);
  console.log(`Last Ping\n${formatLocal(state.lastSuccessfulPing, config.timezone)}\n`);
  console.log(`Next Ping\n${formatLocal(decision.nextPingMs, config.timezone)}\n`);
  console.log(`Remaining\n${decision.action === 'PING' ? 'due now' : formatDuration(decision.remainingMs)}\n`);
  console.log(`Timezone\n${config.timezone}`);
}

async function ping(cwk) {
  const result = await cwk.ping({ force: flags.has('--force') });
  if (!result.ok) return fail(result.error);

  if (asJson) return console.log(JSON.stringify(result.value, null, 2));
  console.log(result.value.action === 'PING'
    ? 'Synchronization completed successfully.'
    : 'No synchronization required.');
}

async function doctor(cwk) {
  const result = await cwk.doctor();
  if (!result.ok) return fail(result.error);

  const { checks, healthy } = result.value;
  if (asJson) return console.log(JSON.stringify(result.value, null, 2));

  console.log('CWK Doctor\n');
  for (const check of checks) {
    console.log(`${check.ok ? '✓' : '✗'} ${check.name}`);
    if (!check.ok) console.log(`  ${check.message}`);
  }
  console.log(healthy ? '\nEverything looks good.' : '\nSome checks failed.');
  if (!healthy) process.exitCode = EXIT.PROJECT;
}

async function reset(cwk) {
  const rl = createPrompter();
  const confirm = await rl.question('This will remove the current CWK project (.cwk/ and the runtime workflow).\n\nContinue? (y/N) ');
  rl.close();
  if (confirm === null || !/^y/i.test(confirm.trim())) return console.log('Aborted.');

  const result = await cwk.reset();
  if (!result.ok) return fail(result.error);
  console.log('CWK project removed.');
}

function help() {
  console.log(`CWK ${CWK_VERSION} — Claude's Window Keeper

Usage: cwk <command> [options]

Commands:
  init      Initialize a CWK project in this repository
  status    Show the current project status
  ping      Run one synchronization cycle
  doctor    Check project health
  reset     Remove the CWK project

Options:
  --force     (ping) Ping even if not due yet
  --json      Machine-readable output
  --verbose   Show error details
  --version   Print CWK version
  --help      Show this help`);
}

function fail(error) {
  console.error(`${error.message}`);
  if (verbose && error.details) console.error(`\n${error.details}`);

  if (error.code?.startsWith('CLAUDE_') || error.code?.startsWith('RUNTIME_')) {
    process.exitCode = EXIT.RUNTIME;
  } else if (error.code?.startsWith('PROJECT_') || error.code === 'STATE_WRITE_FAILED' || error.code === 'WORKFLOW_FILE_MISSING') {
    process.exitCode = EXIT.PROJECT;
  } else {
    process.exitCode = EXIT.USER;
  }
}

main().catch((error) => {
  console.error(verbose ? error : `Internal error: ${error.message}`);
  process.exitCode = EXIT.INTERNAL;
});
