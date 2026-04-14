# SME Template: Architect — stonyx-events

> **Inherits from:** `beatrix-shared/docs/framework/templates/agents/architect.md`
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
| Build | tsc |
| Test | QUnit + Sinon |
| Package Manager | pnpm |

## Architecture Patterns

- **Single-file module:** The entire implementation lives in `src/main.ts` — one class (`Events`) plus exported convenience functions that delegate to a module-level singleton
- **Singleton pattern:** `Events` uses `static instance` — `new Events()` always returns the same object, ensuring all subscribers share one event bus across the application
- **Registration-before-use:** Events must be registered via `setup()` before `subscribe()` or `once()` — subscribing to an unregistered event throws immediately, catching typos at subscribe time rather than at emit time
- **Subscriber storage:** `Map<string, Set<EventCallback>>` — the `Set` automatically deduplicates identical function references, preventing double-fire
- **Error isolation via Promise.all:** `emit()` wraps each subscriber call in its own try/catch inside a `Promise.all`, so one handler throwing does not prevent other handlers from executing
- **Self-removing once wrapper:** `once()` wraps the callback in a function that calls `unsubscribe(event, wrapper)` before invoking the original — the wrapper is the subscription target, not the original callback
- **Unsubscribe-on-subscribe:** `subscribe()` returns an unsubscribe function as its return value, enabling clean teardown without retaining a reference to the callback

## Live Knowledge

- The `stonyx-module` keyword (without `stonyx-async`) means Stonyx loads this module synchronously — no `init()` lifecycle method exists
- `emit()` is async and returns a `Promise<void>` — callers that need to await all handlers must `await emit()`; fire-and-forget callers can skip the await
- `clear(event)` removes all subscribers for one event but keeps the event registered — `reset()` removes both subscribers and registrations
- The module exports both the `Events` class (default) and convenience functions (`setup`, `subscribe`, `once`, `emit`, `unsubscribe`, `clear`, `reset`) — consumer apps typically use only the convenience functions
- There is no built-in event payload typing — the callback signature is `(...args: unknown[])`, so consumers must cast or narrow within their handlers
