# Roadmap

> CWK product roadmap.

**Version:** Draft 1.0

---

# Purpose

This document describes the long-term evolution of CWK.

It is intended to guide future development without imposing strict deadlines.

Features may move between milestones as the project evolves.

The roadmap reflects priorities rather than commitments.

---

# Guiding Principle

CWK should evolve by expanding its capabilities without increasing unnecessary complexity.

Every new feature should preserve the following principles:

- Engine First
- Simple by Default
- Runtime Independent
- Open Source
- Easy to Maintain

---

# Milestone 1 — Foundation

Objective:

Deliver a complete and reliable first release.

Features:

- Core Engine
- CLI
- GitHub Actions runtime adapter
- Claude adapter
- Project initialization
- Project detection
- Project state
- Status command
- Ping command
- Doctor command
- Reset command

Result:

A fully working product capable of synchronizing Claude Code usage windows through GitHub Actions.

---

# Milestone 2 — Better User Experience

Objective:

Improve usability without changing the architecture.

Potential features:

- Better diagnostics
- Colored output
- Progress indicators
- Interactive confirmations
- Better status formatting
- Rich error explanations
- Configuration command
- Execution history

---

# Milestone 3 — Runtime Expansion

Objective:

Support multiple execution environments.

Potential runtime adapters:

- cron
- systemd
- Docker
- Windows Task Scheduler

The Core Engine should remain unchanged.

---

# Milestone 4 — User Interface

Objective:

Provide richer interaction.

Potential features:

- Terminal dashboard (TUI)
- Live status view
- Interactive project browser
- Interactive configuration

The CLI remains fully supported.

The TUI becomes an additional interface, not a replacement.

---

# Milestone 5 — Integrations

Objective:

Integrate CWK into development workflows.

Possible integrations:

- VS Code extension
- JetBrains plugin
- Raycast extension
- Homebrew package
- Winget package
- Docker image

---

# Milestone 6 — Advanced Runtime Features

Potential features:

- Runtime migration
- Multiple runtime adapters
- Runtime health monitoring
- Automatic runtime repair

---

# Milestone 7 — Project Management

Potential features:

- Multiple CWK projects
- Workspace support
- Project discovery
- Project migration
- Backup and restore

---

# Milestone 8 — Ecosystem

Potential features:

- Public documentation website
- Community plugins
- API
- SDK
- Third-party runtime adapters

---

# Future Ideas

The following ideas have been discussed but are intentionally postponed.

## Terminal UI

A complete interactive terminal application.

Example:

```bash
cwk dashboard
```

---

## Notifications

Desktop notifications.

Discord.

Slack.

Telegram.

---

## Cloud Synchronization

Optional synchronization across machines.

---

## Analytics

Optional execution statistics.

Disabled by default.

Privacy-first.

---

## Automatic Updates

Optional update notifications.

---

# Explicit Non-Goals

CWK will not become:

- a Claude client;
- an AI assistant;
- a task scheduler;
- a workflow automation platform.

Its focus remains:

> Keeping Claude Code usage windows synchronized.

---

# Success Criteria

CWK succeeds if it remains:

- lightweight;
- understandable;
- maintainable;
- extensible.

Growth should never come at the expense of simplicity.

Whenever a new feature is proposed, contributors should first ask:

> Does this belong in CWK?

If the answer is uncertain, the feature should remain outside the project until a clear use case emerges.