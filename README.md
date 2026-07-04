# CWK — Claude's Window Keeper

> Keep your Claude Code usage window synchronized.

CWK is a small, engine-first CLI that keeps your Claude Code usage window aligned with your work schedule. It periodically sends a minimal ping through Claude Code so that whenever you sit down to work, the maximum possible window is ahead of you.

CWK does **not** bypass Anthropic limits, increase quotas, or exploit undocumented behavior. It only automates a single action users already perform manually.

## How it works

1. You tell CWK when the **next** ping should happen.
2. CWK stores minimal state in `.cwk/` and generates a GitHub Actions workflow.
3. The workflow wakes CWK every hour; the Core Engine decides `WAIT` or `PING`.
4. When a ping is due, CWK runs a minimal Claude Code command and updates its state.

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
| `cwk reset` | Remove the CWK project |

Global options: `--json`, `--verbose`, `--version`, `--help`.

## Development

```bash
npm install
npm test              # unit + integration
npm run test:unit
npm run test:integration
```

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — engine-first architecture overview
- [AGENTS.md](AGENTS.md) — guidelines for AI coding agents
- [docs/](docs/) — full specification (product, CLI, engine, adapters, roadmap)

## License

[MIT](LICENSE)
