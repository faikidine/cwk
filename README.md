# CWK — Claude's Window Keeper

[![CI](https://github.com/faikidine/cwk/actions/workflows/ci.yml/badge.svg)](https://github.com/faikidine/cwk/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/claude-window-keeper)](https://www.npmjs.com/package/claude-window-keeper)

> Keep your Claude Code usage window ready for long sessions by reducing the next reset time.

> [!NOTE]
> CWK is an independent open-source project. It is **not** affiliated with, endorsed by, or sponsored by Anthropic. "Claude", "Claude AI" and "Claude Code" are trademarks of Anthropic, PBC.

CWK is a small, engine-first CLI that keeps your Claude Code usage window aligned with your work schedule. It periodically sends a minimal ping through Claude Code so that whenever you sit down to work, the maximum possible window is ahead of you.

CWK does **not** bypass Anthropic limits, increase quotas, or exploit undocumented behavior. It only automates a single action users already perform manually.

## How it works

1. You tell CWK when the **next** ping should happen.
2. CWK stores minimal state in `.cwk/` and generates a GitHub Actions workflow.
3. The workflow wakes CWK three times per hour; the Core Engine decides `WAIT`, `WAIT_THEN_PING` or `PING`.
4. GitHub cron fires early, late or not at all — so when the target is close, CWK simply waits inside the run and pings at the exact scheduled time.
5. When a ping is due, CWK runs a minimal Claude Code command and updates its state.

## Quick start

```bash
npm install -g claude-window-keeper

cd your-repository
cwk init
```

The setup is interactive and accepts natural time expressions:

```
When should the NEXT ping happen?
> tomorrow 23:50
```

Also accepted: `23:50`, `23h50`, `11pm`, `in 2 hours`, `next monday 21:00`, …

Then add the `CLAUDE_OAUTH_TOKEN` GitHub Secret (a Claude Code OAuth token), commit, and push. CWK takes care of the rest.

## Commands

| Command | Description |
|---------|-------------|
| `cwk init` | Initialize a CWK project (interactive, confirms before writing) |
| `cwk status` | Show last/next ping, remaining time, timezone |
| `cwk ping` | Run one synchronization cycle (`--force` to ping now) |
| `cwk doctor` | Check project health with actionable fixes |
| `cwk repair` | Fix what doctor found, preserving as much as possible |
| `cwk update` | Bring an existing project to the current CWK format |
| `cwk reset` | Remove the CWK project |

Global options: `--json`, `--verbose`, `--version`, `--help`.

## Updating an existing repository

The generated workflow installs the latest CWK on every run, so the engine updates itself. After a new CWK release, bring the files living in your repository up to date with:

```bash
npm install -g claude-window-keeper@latest
cwk update      # regenerates outdated runtime files, adds new settings
git add -A && git commit -m "chore: update cwk runtime" && git push
```

## Development

```bash
npm install
npm test              # unit + integration
npm run test:unit
npm run test:integration
```

Every push and pull request to `main` runs the full test suite and a package sanity check (CI workflow).

## Releasing

Releases are fully automated (Release workflow):

1. Bump the version: `npm version patch` (or `minor` / `major`).
2. Push to `main` (directly or via PR).
3. The workflow runs the tests, publishes `claude-window-keeper` to npm with provenance, creates the `vX.Y.Z` tag and the GitHub release.

Pushes that do not change the version are skipped automatically. Publishing uses [npm trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC): no npm token is stored in the repository.

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — engine-first architecture overview
- [AGENTS.md](AGENTS.md) — guidelines for AI coding agents
- [docs/](docs/) — full specification (product, CLI, engine, adapters, roadmap)

## Disclaimer

CWK is an independent community project, not affiliated with, endorsed by, or sponsored by Anthropic in any way. "Claude", "Claude AI" and "Claude Code" are trademarks of Anthropic, PBC, used here only to describe compatibility. CWK does not bypass, extend, or alter any Anthropic usage limit: it only automates a minimal action any user can perform manually.

## License

[MIT](LICENSE)
