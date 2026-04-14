# SME Template: QA Test Engineer — stonyx-events

> **Inherits from:** `beatrix-shared/docs/framework/templates/agents/qa-test-engineer.md`
> Load the base template first, then layer this project-specific context on top.

## Project Context

**Repo:** `abofs/stonyx-events`
**Framework:** Stonyx module (`@stonyx/events`) — lightweight pub/sub event system
**Domain:** Application-wide event bus with registration enforcement, async handler support, error isolation, and singleton access

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (compiled to ESM) |
| Test Framework | QUnit |
| Mocking | Sinon |
| Build | tsc with separate `tsconfig.test.json` |
| Test Runner | `qunit` CLI directly (not `stonyx test`) |
| CI | GitHub Actions (`ci.yml`) |

## Architecture Patterns

- **Test build pipeline:** Tests compile to `dist-test/` via `tsconfig.test.json`, then run with `qunit 'dist-test/test/**/*.js'`
- **Singleton teardown required:** Every test module must call `reset()` in its hooks to clear the singleton — otherwise subscriber leaks across tests cause false passes/failures
- **Zero mocking surface for core logic:** Since the module has no external dependencies, most tests are pure behavioral tests — no stubs needed for the happy path
- **Error isolation testing:** Verify that a throwing handler does not prevent sibling handlers from executing during the same `emit()` call — this is the core safety guarantee
- **Async handler testing:** Both sync and async callbacks must be tested — `emit()` wraps all callbacks in `Promise.all`, so async errors must be caught without crashing

## Live Knowledge

- `subscribe()` to an unregistered event must throw synchronously — test this boundary explicitly, not just the happy path
- Duplicate function references in `subscribe()` are deduplicated by the underlying `Set` — test that subscribing the same function twice results in only one invocation on emit
- The `once()` wrapper must unsubscribe before invoking the callback — if the callback itself calls `emit()` for the same event, the once-handler must not re-fire
- `unsubscribe()` on a non-existent event is a no-op (no throw) — this is intentional for safe teardown
- The convenience functions (`setup`, `subscribe`, `emit`, etc.) share the same singleton as `new Events()` — tests can mix both APIs and they must interoperate
- `clear(event)` preserves the registration but removes all subscribers — after `clear`, `subscribe` must still work without calling `setup` again
