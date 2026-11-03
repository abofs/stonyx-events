# @stonyx/events Architecture

## Overview

`@stonyx/events` is a lightweight pub/sub event system for the Stonyx framework. The
whole implementation is one class, `Events` (`src/main.ts`), providing singleton-based
event management with error isolation per handler, async handler support, and
type-safe event registration (events must be declared with `setup()` before anything
can subscribe to or emit them). It carries the `stonyx-module` keyword but not
`stonyx-async`, so the Stonyx module loader never imports or initializes it — there is
no `init()`, and the package works standalone, without Stonyx running.

## Areas

### The event registry / singleton

`Events` enforces a singleton through its constructor: `new Events()` always returns
the same object (`Events.instance`), which is what lets the default export and the
named convenience functions (`setup`, `subscribe`, `once`, `unsubscribe`, `emit`,
`clear`, `reset`) interoperate — both reach the same `events: Map<string,
Set<EventCallback>>` and `registeredEvents: Set<string>`. `setup(eventNames)` is
additive (a second call adds names, never replaces earlier ones) and is what
`subscribe`/`once` validate against before accepting a callback — subscribing to a
name that was never passed to `setup()` throws immediately, which is the module's
only defense against a typo'd event name. `reset()` clears both the subscriber map
and the registered-name set back to pristine, which is why every test calls it before
and after.

### Subscription and emit mechanics

Subscribers live in a `Set<EventCallback>` per event, so the same function reference
subscribed twice collapses to one subscription (by design, to prevent accidental
duplicates — use distinct function instances if you want independent subscriptions).
`subscribe()` and `once()` both return an unsubscribe function; `once()`'s is a
self-removing wrapper that calls `unsubscribe` *before* invoking the original
callback, so a `once` handler that re-emits the same event during its own invocation
does not re-fire, and canceling a pending `once` early requires calling the function
`once()` returned (calling `unsubscribe(event, originalCallback)` does not match the
wrapper). `emit()` maps every current subscriber into a promise and runs them with
`Promise.all()` — concurrently, in `Set` insertion (subscription) order, though that
ordering is not a documented contract. `emit()` on an event with no subscribers, or on
one never `setup()`'d, is a no-op that resolves immediately.

### Error isolation around handlers

Each handler invocation inside `emit()` is individually wrapped in a try/catch: a
throwing or rejecting handler is caught, logged via `console.error`, and does not stop
sibling handlers in the same `emit()` call or propagate out to the caller. `emit()`
itself therefore never rejects on a handler's behalf — awaiting it waits for every
handler to settle, but does not surface any handler's error to the awaiter. This is the
module's whole error-handling story: validation errors (bad arguments to `setup`,
`subscribe`, an unregistered event, a non-function callback) throw immediately and
synchronously; runtime errors from a handler's own logic are caught and only logged.

### Async handler support

Handlers may be sync or async (`EventCallback = (...args: unknown[]) => void |
Promise<void>`); `emit()` always `await`s each one inside its own try/catch regardless
of which. Callers choose their own semantics: `emit(event, ...)` without `await` is
fire-and-forget (handlers still all run, isolated from each other, but the caller
moves on before they finish); `await emit(event, ...)` blocks until every handler —
sync or async — has settled. Payloads are untyped (`unknown[]`); handlers narrow their
own arguments.

Fuller detail — the full method reference, naming conventions, the canonical-samples
contract, and the complete list of boundary behaviors — is in
[Project Structure](project-structure.md) and the [README](../README.md).

## Build, Run, Test

Verified against this repo's `package.json` scripts and a clean `pnpm install
--frozen-lockfile && pnpm test` run (31/31 passing, no lockfile changes):

```bash
pnpm install --frozen-lockfile   # installs; falls back to `pnpm install` if the lockfile is stale
pnpm build                       # tsc -> dist/
pnpm typecheck                   # pnpm build && tsc --noEmit -p tsconfig.test.json
pnpm test                        # pnpm typecheck && node --import tsx node_modules/qunit/bin/qunit.js 'test/**/*-test.ts'
```

`pnpm test` runs `pnpm typecheck` first (which itself runs `pnpm build`, then
type-checks `src/` + `test/` + `config` against `tsconfig.test.json` with no emit),
then runs the QUnit suite directly against the `.ts` test sources under `tsx`. There is
no separate `build:test` script in this package — `typecheck` already serves that role
and is invoked automatically by `pnpm test`; no extra step is required before running
the suite.

This package has no scheduler and makes no use of fake timers — `test/unit/events-test.ts`
and the `test/sample/` tests exercise `Events` directly with real async/await, and no
fake-timer rules apply here (unlike `@stonyx/cron`'s scheduler tests).

## Delivery

`@stonyx/events` is published to npm and consumed as a library inside a Node.js
backend. It has no web, iOS, or Android surface of its own, and (unlike
`@stonyx/cron`) does not even require the Stonyx framework to be initialized first —
it boots standalone. Delivery is "install the package into a Node service."

## Dependencies

- **Runtime dependencies: none.** `package.json` declares no `dependencies` field at
  all. The module is self-contained — a bare `import('@stonyx/events')` loads and
  exposes all eight exports (`default`, `setup`, `subscribe`, `once`, `unsubscribe`,
  `emit`, `clear`, `reset`) with nothing else required to be running.
- **`@stonyx/utils` (devDependency, `0.2.3-beta.28`)** — a utilities module providing
  helpers for files, objects, strings, dates, promises, and interactive CLI prompts.
  `docs/project-structure.md` notes it is currently unused by this package's own
  source — present as a devDependency but not imported anywhere in `src/`.
- **`stonyx` (not a dependency of this package)** — the base Stonyx framework: a
  plug-and-play module system with async module loading/initialization, centralized
  logging, configuration, and a CLI. `@stonyx/events` does not depend on it and does
  not require `Stonyx.ready`, unlike `@stonyx/cron`.

**Downstream:** `@stonyx/orm` depends on `@stonyx/events` for CRUD lifecycle hooks
(`create:before`/`create:after`, `update:before`/`update:after`,
`delete:before`/`delete:after`), via an `ormEvents` singleton instance it provides.

## Guides

- [Project Structure](project-structure.md) — file layout, code patterns, package
  exports, and common pitfalls
- [Testing](testing.md) — test structure, patterns, and coverage areas
- [Release](release.md) — release process
- [Deprecation Remediation](deprecation-remediation.md) — corrective deprecation text
  for the published version that shipped `.git/config`
- [Canonical usage samples](../test/sample/) — runnable, tested usage of every export
