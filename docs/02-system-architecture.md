# System Architecture

> Internal architecture of CWK.

**Version:** Draft 1.0

---

# Purpose

This document defines the architectural principles of CWK.

Its purpose is to describe how the application is organized internally and how each component interacts with the others.

The architecture must remain stable over time.

New features should fit into the existing architecture rather than changing it.

---

# Architecture Philosophy

CWK follows an **Engine First** architecture.

The engine contains every business rule.

Everything else is an adapter.

The engine never knows how it is executed.

It only knows what it has to do.

---

# Core Principle

> The Core Engine owns every business rule.

Scheduling.

Validation.

Initialization.

Project management.

State transitions.

Everything belongs to the engine.

Adapters only execute the engine.

---

# High-Level Architecture

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
        ┌─────────┼─────────┐
        ▼         ▼         ▼
    Scheduler  Project   State
        │
        ▼
      Ports
        │
 ┌──────┼───────────────┐
 ▼      ▼               ▼
Claude Runtime      FileSystem
Port   Adapter       Adapter
```

---

# Architectural Layers

CWK is divided into four logical layers.

## 1. Interface Layer

Responsible for user interaction.

Examples:

- CLI
- future TUI
- future HTTP API

Responsibilities:

- parse user input;
- display output;
- collect interactive answers.

No business logic belongs here.

---

## 2. Facade Layer

The facade exposes a simplified public API.

Examples:

```
cwk.init()

cwk.status()

cwk.ping()

cwk.reset()

cwk.doctor()
```

The CLI communicates only with the facade.

The facade orchestrates the engine.

---

## 3. Core Engine

The Core Engine contains every business rule.

Responsibilities include:

- scheduling;
- project lifecycle;
- validation;
- ping decisions;
- state transitions.

The engine never communicates directly with external systems.

---

## 4. Adapter Layer

Adapters connect the engine to the outside world.

Examples include:

- GitHub Actions;
- Claude Code CLI;
- local filesystem;
- Git;
- future cron runtime;
- future systemd runtime.

Adapters never make business decisions.

---

# Ports

The Core Engine communicates through abstract ports.

Examples:

```
StateStore

ClaudeClient

Runtime

Logger

Clock
```

The engine depends only on these abstractions.

Concrete implementations belong to adapters.

---

# Dependency Rule

Dependencies always point toward the Core.

```
CLI

↓

Facade

↓

Core

↓

Ports

↓

Adapters
```

Reverse dependencies are forbidden.

The Core must never import an adapter.

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

        claude/

        github/

        filesystem/

        git/

    shared/

package.json

README.md
```

Each directory has one responsibility.

---

# Runtime Independence

CWK is runtime independent.

The engine should not know whether it is executed by:

- GitHub Actions;
- cron;
- Docker;
- systemd;
- Windows Task Scheduler;
- another application.

Every runtime simply executes the engine.

---

# Runtime Adapters

Version 1 officially provides:

- GitHub Actions.

Future adapters may include:

- cron;
- Docker;
- systemd;
- Windows Task Scheduler.

Adding a runtime adapter must never require modifications to the Core Engine.

---

# State Ownership

The engine owns the project state.

Adapters only persist it.

The engine decides **what** changes.

The adapter decides **how** it is stored.

---

# Time Ownership

The engine owns every scheduling calculation.

Adapters never compute elapsed time.

Adapters never decide whether a ping should occur.

---

# Claude Ownership

The engine decides **when** Claude should be contacted.

The Claude adapter only knows **how** to contact Claude.

---

# Error Ownership

Business errors belong to the engine.

Infrastructure errors belong to adapters.

The facade translates both into user-facing messages.

---

# Design Patterns

CWK intentionally uses a small number of well-known patterns.

## Facade

Expose a simple public API.

---

## Ports & Adapters

Keep the engine independent from infrastructure.

---

## Repository

Abstract project persistence.

---

## Strategy

Allow multiple runtime implementations.

---

## Dependency Injection

Inject every external dependency into the engine.

---

# Explicitly Avoided

CWK intentionally avoids:

- service locator;
- singleton abuse;
- deep inheritance;
- plugin frameworks;
- event buses;
- unnecessary abstractions.

The architecture should remain understandable by a single developer.

---

# Architectural Rule

If a new feature requires modifying the Core Engine to support a different runtime environment, the architecture is probably wrong.

The Core defines the rules.

Adapters execute them.