# Core Engine

> Business logic specification.

**Version:** Draft 1.0

---

# Purpose

The Core Engine is the heart of CWK.

It owns every business rule.

It is responsible for making decisions.

It is intentionally unaware of:

- GitHub Actions
- cron
- Docker
- Node.js APIs
- filesystem implementations
- Claude CLI implementation details

Its responsibility is to decide **what** should happen.

Adapters decide **how** it happens.

---

# Responsibilities

The Core Engine is responsible for:

- project lifecycle
- scheduling
- synchronization
- state transitions
- validation
- initialization
- diagnostics

No other component should implement business rules.

---

# Public API

The Facade exposes the engine through a small public API.

Example:

```ts
engine.initialize()

engine.status()

engine.synchronize()

engine.reset()

engine.doctor()
```

The CLI must never bypass the Facade.

---

# Engine Lifecycle

Every execution follows the same lifecycle.

```
Receive Request

↓

Load Project

↓

Validate Project

↓

Execute Use Case

↓

Persist Changes

↓

Return Result
```

---

# Initialization

Initialization creates a valid CWK project.

Responsibilities include:

- validating repository state
- computing initial scheduling state
- creating required project metadata
- preparing runtime configuration

The engine never writes files directly.

It returns a plan to the infrastructure layer.

---

# Synchronization

Synchronization is the primary use case.

Steps:

1. Load project state.

2. Determine current time.

3. Compute elapsed time.

4. Decide whether synchronization is required.

5. If required:

    Request Claude ping.

6. Update state.

7. Return execution result.

---

# Scheduling

The engine owns scheduling.

Inputs:

- previous successful ping
- configured interval
- current time

Output:

```
WAIT

or

PING
```

Nothing else.

---

# State Machine

Synchronization follows a simple state machine.

```
READY

↓

CHECK

↓

WAIT
or
PING

↓

SUCCESS

↓

READY
```

Failures always return to READY.

---

# Validation

Every public operation validates:

- project exists
- configuration exists
- state is valid
- runtime configuration exists

Validation happens before execution.

---

# Result Objects

The engine never prints messages.

Instead it returns structured results.

Example:

```ts
{
    success: true,
    action: "ping",
    updatedState: ...
}
```

or

```ts
{
    success: false,
    reason: "PROJECT_NOT_INITIALIZED"
}
```

The CLI is responsible for presentation.

---

# Time

The engine never manipulates local time.

Every calculation uses absolute timestamps.

Formatting belongs to adapters.

---

# Error Handling

Business errors remain inside the engine.

Infrastructure failures are propagated by adapters.

The Facade converts both into user-facing responses.

---

# Testing

The engine should be testable without:

- Git
- GitHub
- Claude
- filesystem
- internet
- operating system

Every dependency must be replaceable.

---

# Architectural Rule

The Core Engine must remain completely independent from infrastructure.

Every new feature should first answer:

> Does this belong to the engine or to an adapter?

If the answer is unclear, the design should be reconsidered before implementation.