# SME Template: Validation Loop Team — stonyx-events

> **Inherits from:** `beatrix-shared/docs/framework/templates/agents/validation-loop-team.md`
> Load the base template first, then layer this project-specific context on top.

## Project Context

**Repo:** `abofs/stonyx-events`
**Framework:** Stonyx module (`@stonyx/events`) — lightweight pub/sub event system
**Domain:** Application-wide event bus with registration enforcement, async handler support, error isolation, and singleton access

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (compiled to ESM) |
| Runtime | Node.js |
| Dependencies | Zero runtime dependencies |
| Test | QUnit + Sinon |
| Build | tsc (src → dist, test → dist-test) |

## Architecture Patterns

- **Registration gate is the primary safety mechanism:** `setup()` must be called before any `subscribe()`/`once()` — validation must confirm this gate cannot be bypassed (e.g., by directly manipulating the `events` Map)
- **Singleton integrity:** `new Events()` must always return the same instance — validation should confirm that creating multiple instances shares state and that `reset()` properly clears the singleton for the next `new Events()` call
- **Error isolation completeness:** `emit()` must catch errors per-handler — validation should confirm that a sync throw, an async rejection, and a mix of both all result in isolated failures with remaining handlers still executing
- **Once semantics under re-entrancy:** A `once()` handler that triggers another `emit()` of the same event must not re-fire — the unsubscribe happens before the callback invocation
- **Unsubscribe function correctness:** The function returned by `subscribe()` must remove exactly that subscription — not other subscriptions to the same event

## Live Knowledge

- The `Events` class exposes `events` and `registeredEvents` as public properties — validation should treat direct mutation of these as an unsupported but possible vector for state corruption
- `emit()` returns `Promise<void>` — callers that don't await it will miss handler errors entirely; this is by design but worth flagging in validation notes
- The module has no config dependency and no Stonyx lifecycle hooks — it is fully self-contained and can be tested without any Stonyx framework setup
- `setup()` is additive — calling it multiple times with different arrays merges the registrations; it does not replace previous ones
- Handler execution order within a single `emit()` follows `Set` iteration order (insertion order) — while not a documented contract, tests may implicitly depend on it
