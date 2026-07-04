# Product Specification

> Functional requirements for CWK.

**Version:** Draft 1.0

---

# Purpose

This document defines the expected behavior of CWK.

It specifies what the product must do, what problems it solves, and the expected user experience.

This document intentionally excludes implementation details.

The implementation is described by the System Architecture document.

---

# Product Goals

CWK should allow users to maintain an optimized Claude Code usage window with minimal effort.

The product should require as little configuration as possible while remaining predictable, transparent and reliable.

After the initial setup, users should rarely need to interact with CWK again.

---

# Target Audience

CWK is designed for developers who:

- actively use Claude Code;
- work in long development sessions;
- use GitHub repositories;
- want a predictable usage window without manual maintenance.

Technical knowledge of GitHub Actions, cron expressions or UTC timestamps should not be required.

---

# User Journey

The intended user experience is:

1. Install CWK.

```bash
npm install -g cwk
```

2. Initialize a repository.

```bash
cwk init
```

3. Complete the interactive setup.

4. Configure the required GitHub Secret.

5. Push the repository.

6. Let CWK run automatically.

---

# Core Features

CWK must provide the following capabilities.

## Project Initialization

CWK initializes a repository by:

- creating the required project files;
- generating the runtime adapter configuration;
- storing the initial project state.

CWK must never overwrite an existing project without explicit confirmation.

---

## Project Detection

CWK must automatically detect whether the current repository has already been initialized.

If an existing CWK project is found, the user should be informed before any modification occurs.

---

## Interactive Setup

Initialization should be interactive.

CWK must detect as much information as possible automatically.

Examples include:

- local timezone;
- Git repository;
- current branch;
- operating system.

Only information that cannot be inferred should be requested from the user.

---

## Next Ping Configuration

During initialization, CWK asks:

> When should the NEXT ping happen?

The user never provides the previous ping.

CWK computes the internal state automatically.

---

## Time Parsing

CWK should accept common time formats.

Examples include:

```
23:50

23h50

11:50 PM

11pm

today 23:50

tomorrow 18:00

in 2 hours

next monday 21:00
```

Whenever possible, CWK should interpret user input rather than rejecting it.

Natural-language parsing is provided by the `chrono-node` library (English, with a French fallback for formats such as `23h50`).

The parsed time must always resolve to the future: a plain time that already passed today rolls over to tomorrow.

---

## Runtime Execution

CWK periodically evaluates whether a ping is required.

If no ping is necessary, CWK exits immediately.

If a ping is required:

- Claude Code is contacted;
- project state is updated;
- execution completes successfully.

---

## Status Inspection

Users should always be able to inspect the current project state.

Information should include:

- initialization status;
- runtime adapter;
- last successful ping;
- next expected ping;
- remaining time;
- configured interval;
- timezone.

---

## Diagnostics

CWK should provide diagnostic information about the project.

Examples include:

- missing configuration;
- invalid project structure;
- inconsistent state;
- missing runtime files.

Diagnostic messages should always explain how the issue can be resolved.

---

## Reset

CWK should allow the current project to be reset.

Resetting a project must always require explicit confirmation.

---

# Runtime Adapters

CWK is runtime-independent.

The Core Engine owns all scheduling decisions.

Runtime adapters are only responsible for executing the engine periodically.

Version 1 officially supports:

- GitHub Actions.

Future versions may support:

- cron;
- systemd;
- Docker;
- Windows Task Scheduler.

Adding new runtime adapters must not require modifications to the Core Engine.

---

# Configuration

CWK should work with sensible defaults.

Advanced configuration is optional.

Users should rarely need to manually edit configuration files.

---

# Error Handling

CWK should always explain:

- what happened;
- why it happened;
- how to resolve it.

Error messages should avoid exposing implementation details unless verbose mode is enabled.

---

# Non-Goals

CWK does not:

- increase Claude usage limits;
- bypass Anthropic restrictions;
- automate conversations;
- replace Claude Code;
- manage Claude projects.

The product focuses exclusively on usage window synchronization.

---

# Acceptance Criteria

Version 1 is considered complete when a user can:

- install CWK;
- initialize a repository;
- configure the required GitHub Secret;
- automatically maintain a synchronized Claude Code usage window with no further manual intervention.

---

# Product Principles

Every new feature should satisfy at least one of the following goals:

- reduce user effort;
- improve reliability;
- simplify configuration;
- improve transparency;
- improve maintainability.

If a feature does not improve one of these areas, it should not be added to CWK.