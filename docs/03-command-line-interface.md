# Command-Line Interface

> Public interface specification for CWK.

**Version:** Draft 1.0

---

# Purpose

This document specifies the public Command-Line Interface (CLI) exposed by CWK.

It defines every command, its behavior, its expected output and the interaction model.

This document is the public API of CWK.

Any breaking change to the CLI must be reflected here before implementation.

---

# CLI Philosophy

The CLI should feel:

- simple;
- predictable;
- interactive;
- beginner-friendly;
- scriptable.

The user should never need to understand the internal architecture of CWK.

---

# General Syntax

CWK follows a Git-like command structure.

```bash
cwk <command> [options]
```

Examples:

```bash
cwk init
cwk status
cwk ping
cwk doctor
cwk repair
cwk reset
```

---

# Interactive Philosophy

CWK prefers interaction over arguments.

Whenever possible, CWK should guide the user through prompts instead of requiring long command-line options.

For example:

```bash
cwk init
```

is preferred over:

```bash
cwk init \
  --adapter github \
  --timezone Europe/Paris \
  --next "23:50"
```

The CLI should only expose options for scripting and automation.

---

# Commands

## init

Creates a new CWK project.

If no CWK project exists in the current repository, CWK starts an interactive setup.

The setup should automatically detect:

- Git repository
- default branch
- local timezone

CWK should only ask for information that cannot be inferred.

---

### Interactive Flow

Example:

```text
CWK Initialization

Repository:
✓ my-awesome-project

Timezone:
✓ Europe/Paris

Runtime Adapter:
✓ GitHub Actions

When should the NEXT ping happen?

> 23:50
```

CWK then computes every required internal value automatically.

The user never enters UTC timestamps.

---

### Execution Plan

Before modifying the repository, CWK displays a summary.

Example:

```text
CWK Setup Plan

Repository
✓ my-awesome-project

Runtime
✓ GitHub Actions

Timezone
✓ Europe/Paris

Next Ping
Today at 23:50

Files to create

✓ .cwk/config.json
✓ .cwk/state.json
✓ .cwk/metadata.json
✓ .github/workflows/cwk.yml

Required GitHub Secret

CLAUDE_OAUTH_TOKEN

Continue? (Y/n)
```

No files should be created before confirmation.

---

## status

Displays the current project status.

Example:

```text
CWK Status

Project
✓ Initialized

Runtime
GitHub Actions

Last Ping
18:50

Next Ping
23:50

Remaining
03:14:52

Timezone
Europe/Paris
```

---

## ping

Runs one synchronization cycle.

The command evaluates whether a ping is required.

If no ping is necessary:

```text
No synchronization required.
```

If the next ping is due within the configured patience, the command
waits for the exact moment (plus a one-minute safety margin, so a ping
never fires early because of clock drift), then pings:

```text
Next ping due in 12 minutes. Waiting to ping exactly on time...
Synchronization completed successfully.
```

`--no-wait` disables this behavior (the command reports and exits
immediately, useful for scripts that must not block).

If a ping is required:

```text
Synchronization completed successfully.
```

---

## doctor

Performs a health check.

Checks include:

- project integrity
- configuration
- runtime configuration
- required files
- state consistency

Example:

```text
CWK Doctor

✓ Project

✓ Configuration

✓ Runtime

✓ State

✓ Workflow

Everything looks good.
```

When checks fail, `doctor` suggests running `cwk repair`.

---

## repair

Fixes problems reported by `doctor` while preserving as much information as possible.

Principles:

- never requires a reset;
- only rewrites files that are actually broken;
- keeps every valid value it can recover (configuration fields, custom cron minute, state);
- explains in natural language what was broken and what was done.

Example:

```text
CWK Repair

⚠ Runtime
  was: The workflow was missing the step that runs cwk ping.
  now: Regenerated .github/workflows/cwk.yml (kept your schedule minute 17).

⚠ Configuration
  was: intervalHours was not a positive number.
  now: Restored the default (5 hours). All other settings were preserved.

2 problems repaired. Run cwk doctor to verify.
```

When there is nothing to fix:

```text
CWK Repair

✓ Nothing to repair. Everything looks good.
```

If no project exists at all, `repair` cannot help and points to `cwk init`.

When a value cannot be recovered (for example a corrupted state), repair falls back to the safest default and tells the user how to adjust it (`cwk ping --force`).

---

## reset

Removes the current CWK configuration.

The user must always confirm before destructive operations.

Example:

```text
This will remove the current CWK project.

Continue?

(Y/n)
```

---

# Global Options

Every command supports:

```bash
--help

--version

--verbose

--json
```

---

# Output Rules

CWK should:

- explain what it is doing;
- avoid unnecessary verbosity;
- never expose stack traces by default;
- use colors when supported.

Errors should always include actionable guidance.

Bad:

```text
Configuration Error
```

Good:

```text
Configuration file not found.

Run:

cwk init
```

---

# Exit Codes

| Code | Meaning |
|------:|---------|
| 0 | Success |
| 1 | User error |
| 2 | Project error |
| 3 | Runtime error |
| 4 | Internal error |

---

# Future Commands

The following commands are intentionally excluded from Version 1.

```bash
cwk dashboard

cwk logs

cwk config

cwk update

cwk adapter

cwk export

cwk import
```

Their behavior will be specified separately when introduced.

---

# Stability Policy

The CLI is the public API of CWK.

Every released command should remain backward compatible whenever reasonably possible.

Breaking changes require a major version.