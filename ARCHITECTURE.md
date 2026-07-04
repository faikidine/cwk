# CWK Architecture

> High-level architecture overview.

This document provides a quick overview of the CWK architecture.

It is intended for both human contributors and AI coding agents.

For implementation details, refer to the documentation inside `docs/`.

---

# Core Philosophy

CWK is **Engine First**.

Everything revolves around one central component:

> **The Core Engine**

The Core Engine defines every business rule.

Everything else exists only to support it.

---

# Architecture

```
                         User
                          │
                          ▼
                Command Line Interface
                          │
                          ▼
                      CWK Facade
                          │
                          ▼
                    Core Engine
      ┌───────────────────┼───────────────────┐
      ▼                   ▼                   ▼
 Scheduler          Project Manager      State Manager
      │                   │                   │
      └───────────────────┼───────────────────┘
                          ▼
                         Ports
      ┌───────────────────┼────────────────────┐
      ▼                   ▼                    ▼
 Claude Adapter   Runtime Adapter     Storage Adapter
                          │
                          ▼
               GitHub Actions (v1)
```

---

# Dependency Direction

Dependencies always point toward the Core.

```
CLI

↓

Facade

↓

Core Engine

↓

Ports

↓

Adapters
```

Reverse dependencies are forbidden.

The Core never imports adapters.

Adapters always depend on the Core.

---

# Responsibilities

## CLI

Responsible for interacting with the user.

Examples:

- parsing commands;
- displaying output;
- interactive prompts.

The CLI contains no business logic.

---

## Facade

Provides a simple public API.

Example:

```ts
cwk.init()
cwk.status()
cwk.ping()
cwk.reset()
cwk.doctor()
```

The CLI communicates only with the Facade.

---

## Core Engine

The heart of CWK.

Owns every business rule.

Responsible for:

- scheduling;
- synchronization;
- validation;
- project lifecycle;
- state transitions.

The Core must remain independent from infrastructure.

---

## Ports

Ports define abstract interfaces used by the Core.

Examples:

- ClaudeClient
- StateStore
- Runtime
- Clock
- Logger

The Core depends only on Ports.

---

## Adapters

Adapters connect CWK to external systems.

Examples:

- Claude Code
- GitHub Actions
- filesystem
- Git

Adapters never implement business rules.

---

# Runtime Independence

CWK does not depend on GitHub Actions.

GitHub Actions is simply the default runtime adapter for Version 1.

Future adapters may include:

- cron
- Docker
- systemd
- Windows Task Scheduler

The Core Engine should not require modification when adding a new runtime.

---

# Engine Workflow

Every execution follows the same flow.

```
Request

↓

Load Project

↓

Validate

↓

Execute Use Case

↓

Update State

↓

Return Result
```

The Core never prints output.

It only returns results.

---

# Business Rule Ownership

The Core owns:

- scheduling
- synchronization
- validation
- project state
- project lifecycle

Adapters own:

- filesystem
- GitHub Actions
- Claude CLI
- Git
- operating system

This separation must always be preserved.

---

# Project Structure

```
cwk/

docs/

src/

    cli/

    facade/

    engine/

    ports/

    adapters/

    shared/

.cwk/

README.md

ARCHITECTURE.md

AGENTS.md
```

---

# Documentation

Every major aspect of CWK has its own document.

```
docs/

00-project-overview.md

01-product-specification.md

02-system-architecture.md

03-command-line-interface.md

04-core-engine.md

05-project-format.md

06-adapters.md

07-roadmap.md
```

Architecture decisions should be reflected in documentation before implementation.

---

# Design Principles

CWK follows these principles.

## Engine First

Business logic belongs to the Core.

---

## Simple by Default

Prefer the simplest solution that satisfies the requirements.

Avoid unnecessary abstractions.

---

## Runtime Independent

The Core should never know how it is executed.

---

## Documentation First

Behavior is documented before it is implemented.

---

## Single Responsibility

Every module owns one responsibility.

---

## Explicit Over Implicit

Prefer clear code over clever code.

---

## Testability

The Core should be testable without:

- GitHub
- Git
- Claude
- filesystem
- internet

---

# Golden Rules

The following rules are non-negotiable.

1. The Core owns every business rule.

2. Adapters execute, they do not decide.

3. The CLI presents information, it does not implement business logic.

4. Ports isolate the Core from infrastructure.

5. Documentation is updated before code.

6. New runtime adapters must not require changes to the Core Engine.

7. Simplicity always wins over cleverness.

---

# Mental Model

Think of CWK as a small operating system.

The Core Engine is the kernel.

Adapters are device drivers.

The CLI is the shell.

The user interacts with the shell.

The shell talks to the kernel.

The kernel communicates with the outside world through drivers.

This mental model should guide every architectural decision made throughout the lifetime of the project.