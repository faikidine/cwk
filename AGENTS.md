# AGENTS.md

> Development guidelines for AI coding agents working on CWK.

---

# Purpose

This document defines the engineering rules that every AI coding agent must follow when contributing to CWK.

It complements the project documentation and serves as the authoritative development guide for autonomous code generation.

Every architectural decision documented here takes precedence over implementation convenience.

---

# Read This First

Before writing or modifying any code, you MUST read the following documents in order.

1. docs/00-project-overview.md
2. docs/01-product-specification.md
3. docs/02-system-architecture.md
4. docs/03-command-line-interface.md
5. docs/04-core-engine.md
6. docs/05-project-format.md
7. docs/06-adapters.md
8. docs/07-roadmap.md

Never skip this step.

---

# Project Philosophy

CWK follows one fundamental principle:

> The Core Engine owns every business rule.

Everything else exists to support the Core.

Whenever a design decision is unclear, preserve this principle.

---

# Engine First

CWK is **Engine First**.

The engine must remain completely independent from:

- GitHub Actions
- cron
- Docker
- systemd
- Node.js APIs
- filesystem implementation
- Claude CLI implementation
- terminal UI

The engine should be reusable in any runtime.

---

# Layer Responsibilities

Respect the architectural layers.

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

Dependencies always point downward.

Never invert dependencies.

---

# Never Put Business Logic In...

The following components MUST NEVER contain business logic:

- CLI
- runtime adapters
- Claude adapter
- filesystem adapter
- Git adapter
- logger

Business rules belong exclusively to the Core Engine.

---

# Adapter Rule

Adapters translate.

They do not decide.

If an adapter needs to answer:

> "Should a ping happen?"

The architecture has been violated.

---

# Facade Rule

External callers should communicate only with the Facade.

Avoid exposing internal engine classes directly.

The Facade represents the public API of CWK.

---

# Single Responsibility

Every module should have exactly one responsibility.

If a file starts solving multiple unrelated problems, split it.

Do not create abstractions prematurely.

---

# Simplicity First

Prefer:

- simple code
- explicit code
- readable code

Avoid:

- unnecessary inheritance
- clever abstractions
- over-engineering
- hidden side effects

---

# Before Adding Code

Always ask:

1. Does this belong to the Core?
2. Does this belong to an Adapter?
3. Does this belong to the CLI?
4. Does documentation already describe this behavior?

If documentation does not describe the feature, update documentation first.

---

# Documentation First

CWK follows a Documentation First workflow.

Behavior should never appear in code before being documented.

Whenever functionality changes:

1. Update documentation.
2. Then update code.

Never do the opposite.

---

# Public CLI

The CLI is a stable public API.

Do not:

- rename commands;
- remove commands;
- silently change command behavior.

Any breaking CLI change requires documentation updates.

---

# Project Format

The `.cwk/` directory is the canonical project representation.

Never introduce hidden files outside the documented project format.

Never modify project files that are not owned by the current component.

---

# Time

The engine works exclusively with absolute timestamps.

User-facing formatting belongs elsewhere.

Never perform scheduling calculations inside adapters.

---

# Errors

Never throw generic errors when structured results are possible.

Business failures should return meaningful domain errors.

Infrastructure failures should remain infrastructure errors.

---

# Logging

The Core Engine never prints messages.

The CLI owns presentation.

Adapters may produce diagnostic information only when necessary.

---

# Testing Philosophy

The Core Engine should be testable without:

- GitHub
- Git
- Claude
- internet
- filesystem
- operating system

Every dependency should be replaceable.

---

# Code Style

Prefer:

- small functions
- descriptive names
- immutable data where practical
- early returns
- composition over inheritance

Avoid:

- deeply nested conditionals
- giant classes
- giant functions
- duplicated business logic

---

# Backward Compatibility

Do not break existing project formats without introducing migrations.

Do not break CLI behavior unless explicitly approved.

---

# Runtime Independence

Never assume GitHub Actions.

GitHub Actions is the default runtime adapter for Version 1.

It is not part of the Core architecture.

Future runtimes should integrate without changing the Core Engine.

---

# Security

Never:

- expose secrets
- log authentication tokens
- write credentials to project files
- commit sensitive information

Authentication must remain outside the project state.

---

# When In Doubt

When multiple implementations are possible, prefer the one that:

1. preserves Engine First;
2. keeps the Core independent;
3. minimizes coupling;
4. reduces complexity;
5. improves readability.

Correct architecture is more important than clever implementation.

---

# Golden Rule

If implementing a feature requires changing the Core because of a runtime-specific constraint, stop.

The architecture is probably wrong.

Revisit the design before writing code.