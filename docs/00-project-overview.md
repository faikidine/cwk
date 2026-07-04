# CWK — Claude Window Keeper

> Keep your Claude Code usage window synchronized.

**Version:** Draft 1.0

---

# What is CWK?

CWK is an open-source command-line tool that helps users maintain a predictable Claude Code usage window.

It does this by running a lightweight synchronization engine at regular intervals. When the engine determines that enough time has passed, it sends a minimal ping through Claude Code and updates its internal state.

CWK is not tied to a single runtime environment.

In v1, CWK uses GitHub Actions as its default runtime adapter.

In future versions, CWK may support other runtime adapters such as local cron, systemd, Docker, or Windows Task Scheduler.

---

# Mission

CWK exists to remove the operational overhead of managing Claude Code usage windows.

Users should not have to think about:

- timers;
- UTC timestamps;
- cron syntax;
- GitHub Actions workflows;
- manual reminder systems.

CWK should handle that automatically.

---

# Core Idea

CWK is engine-first.

The core engine owns the rules.

Adapters only execute.

This means CWK’s core logic should not depend on GitHub Actions, cron, Docker, or any specific runtime.

The engine answers one main question:

> Should a ping be sent now?

Everything else exists to support that decision.

---

# Why CWK Exists

Claude Code usage is managed through time-based usage windows.

Some users manually send a minimal prompt at specific times to align their usage window with their work schedule.

This manual process is repetitive and easy to forget.

CWK automates it in a controlled, transparent, and auditable way.

---

# What CWK Does

CWK:

- initializes a project;
- stores minimal project state;
- computes when the next ping should happen;
- sends a minimal Claude Code ping when needed;
- updates its state after successful execution;
- provides status and diagnostics commands.

In v1, CWK also generates a GitHub Actions workflow so the system can run even when the user’s computer is offline.

---

# What CWK Does Not Do

CWK does not:

- bypass Anthropic limits;
- increase Claude usage quotas;
- exploit undocumented behavior;
- automate conversations;
- replace Claude Code;
- hide its behavior from the user.

CWK only automates a simple action that users can already perform manually.

---

# User Experience

The intended v1 flow is:

```bash
npm install -g cwk
```

Then, inside a GitHub repository:

```bash
cwk init
```

CWK detects the local environment and asks when the **next** ping should happen.

Example:

```text
When should the NEXT ping happen?
> 23:50
```

CWK then computes the internal state automatically.

The user never has to calculate the previous ping manually.

---

# Runtime Model

In v1, the default runtime adapter is GitHub Actions.

The generated workflow periodically wakes CWK.

CWK then decides whether a ping is required.

GitHub Actions does not contain scheduling intelligence.

It only runs CWK.

---

# Project Marker

A CWK-enabled repository contains a `.cwk/` directory.

Example:

```text
.cwk/
├── config.json
├── state.json
└── metadata.json
```

This directory allows CWK to detect that the repository has already been initialized.

---

# Design Principles

## Engine First

The core engine must remain independent from any runtime environment.

GitHub Actions is only one adapter.

---

## Simple by Default

The v1 user experience must stay simple.

GitHub Actions is the default adapter.

Other adapters may be supported later, but they should not complicate the v1 setup.

---

## Human-Centered

Users think in terms of:

> When should the next ping happen?

They do not think in terms of:

> What should the previous UTC timestamp be?

CWK should hide technical details whenever possible.

---

## Transparent

CWK must clearly explain what it creates, what it changes, and what the user must configure manually.

Before modifying a repository, CWK should display a setup plan and ask for confirmation.

---

## Robust

CWK should continue working even if:

- GitHub Actions is delayed;
- a scheduled run is skipped;
- the local computer is offline;
- daylight saving time changes;
- the user changes timezone.

Internal time calculations should rely on absolute timestamps.

---

# Long-Term Vision

CWK should become a small, reliable, open-source utility for keeping Claude Code usage windows synchronized across different environments.

Future runtime adapters may include:

- GitHub Actions;
- local cron;
- systemd;
- Docker;
- Windows Task Scheduler.

The project should remain lightweight, auditable, and easy to contribute to.

---

# Success Criteria

CWK is successful when a user can install it, initialize a repository, configure the required token once, and then forget that CWK exists.