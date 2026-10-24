# @stonyx/events - Project Structure & Architecture

## Detailed Guides

- [Testing Guidelines](./testing.md) — Test structure, patterns, and coverage areas

## Project Overview

**@stonyx/events** is a lightweight pub/sub event system for the Stonyx framework. It provides a singleton-based event management system with error isolation, async support, and type-safe event registration.

### Core Purpose
- Provide application-wide event bus for decoupled communication
- Support async event handlers with error isolation
- Ensure type safety through event registration
- Maintain singleton pattern for shared event system

### Technology Stack
- **Runtime**: Node.js v24.13.0
- **Module System**: ES Modules
- **Testing**: QUnit 2.24.1 + Sinon 21.0.0
- **License**: Apache 2.0

## Architecture Overview

### Design Patterns

**Singleton Pattern**
- Single Events instance shared across the application
- Prevents multiple competing event systems
- Ensures all parts of the application use the same event bus

**Error Isolation**
- Errors in one handler don't affect other handlers
- All handlers run even if some fail
- Errors are logged to console.error but don't propagate

**Async Support**
- All event handlers can be async functions
- `emit()` waits for all handlers to complete
- Handlers run in parallel via Promise.all()

**Type Safety**
- Events must be registered with `setup()` before use
- Prevents typos and invalid event names
- Enforces explicit event declarations

## File Structure

```
stonyx-events/
├── .github/
│   └── workflows/
│       ├── ci.yml                # GitHub Actions CI pipeline
│       ├── publish.yml           # NPM publish workflow (shared stonyx-workflows pipeline)
│       └── security-audit.yml    # Dependency audit
├── .claude/
│   └── CLAUDE.md                 # Pointer to docs/index.md
├── docs/
│   ├── index.md                  # Documentation entry point
│   ├── project-structure.md      # This file
│   ├── testing.md                # Testing guidelines
│   ├── release.md                # Release instructions
│   └── deprecation-remediation.md # Runbook for the published 0.1.0 deprecation text
├── scripts/
│   └── deprecation-remediation.sh # --check / --apply for that runbook
├── src/
│   └── main.ts                   # Events class implementation
├── test/
│   ├── sample/                   # Canonical usage samples (README link); run by unit/sample-test.ts, guarded by unit/sample-surface-test.ts
│   │   ├── class.ts              # new Events(), instance methods, shared singleton
│   │   └── convenience.ts        # setup/subscribe/once/unsubscribe/emit/clear/reset
│   └── unit/
│       ├── events-test.ts        # QUnit tests for Events
│       ├── sample-test.ts        # Runs every sample in test/sample/ and asserts what its handlers observed
│       └── sample-surface-test.ts # Fails if an export, sample, or import specifier falls outside the sample contract
├── .gitignore                    # Git ignore patterns
├── .npmignore                    # NPM ignore patterns
├── .nvmrc                        # Node version specification
├── LICENSE.md                    # Apache 2.0 license
├── README.md                     # User-facing documentation
└── package.json                  # NPM package configuration
```

## Core Components Deep Dive

### Events Class (`src/main.ts`)

The Events class is the heart of the module, providing all pub/sub functionality.

#### Properties

**`static instance`** (Events|null)
- Singleton instance reference
- Ensures only one Events instance exists

**`events`** (Map<string, Set<Function>>)
- Map of event names to their subscriber sets
- Uses Set to prevent duplicate subscriptions
- Automatically created when events are registered

**`registeredEvents`** (Set<string>)
- Set of all registered event names
- Used to validate subscriptions
- Prevents subscribing to unregistered events

#### Methods

**`setup(eventNames: string[])`**
- Register available event names
- Must be called before subscribing to events
- Validates that all names are strings
- Creates empty subscriber sets for each event

**`subscribe(event: string, callback: Function)`**
- Subscribe to an event
- Throws if event is not registered
- Throws if callback is not a function
- Returns an unsubscribe function
- Callback signature: `(...args: any[]) => void | Promise<void>`

**`once(event: string, callback: Function)`**
- Subscribe to an event once
- Auto-unsubscribes after first emit
- Wraps callback in a self-removing wrapper
- Returns an unsubscribe function
- Supports async callbacks

**`emit(event: string, ...args: any[])`**
- Emit an event with arguments
- Async function that waits for all handlers
- Runs all handlers in parallel
- Isolates errors per handler
- Does nothing if event has no subscribers

**`unsubscribe(event: string, callback: Function)`**
- Remove a specific subscription
- Safe to call multiple times
- Does nothing if event or callback doesn't exist

**`clear(event: string)`**
- Remove all subscriptions for an event
- Useful for cleanup between tests
- Event remains registered

**`reset()`**
- Clear all subscriptions and registrations
- Resets to pristine state
- Essential for test isolation

## Dependencies & Integration

### Production Dependencies
None. This module has zero production dependencies.

### Dev Dependencies

**@stonyx/utils**
- Utility functions (currently unused but available)

**qunit** (^2.24.1)
- Testing framework
- Runs via `pnpm test`, which first runs `pnpm typecheck` (build `dist/`, then type-check `src/` and `test/`), then QUnit through tsx

**sinon** (^21.0.0)
- Mocking/stubbing library
- Available for advanced testing scenarios

### Stonyx Loading

The package carries the `stonyx-module` keyword without `stonyx-async`, so the Stonyx loader does not import or initialize it; there is no `init()`. Consumers import it directly, and it works without Stonyx running.

### Modules That Depend on @stonyx/events

**@stonyx/orm**
- Uses Events for CRUD lifecycle hooks
- Fires events: create:before, create:after, update:before, update:after, delete:before, delete:after
- Provides `ormEvents` singleton instance

## Code Patterns & Conventions

### Module System
- ES Modules throughout
- Default export for Events class
- Named convenience exports: `setup`, `subscribe`, `once`, `unsubscribe`, `emit`, `clear`, `reset`

### Error Handling
- Validation errors throw immediately
- Runtime errors in handlers are caught and logged
- No silent failures

### Naming Conventions
- Event names: camelCase strings (e.g., 'userLogin', 'dataChange')
- Method names: lowercase verbs (setup, subscribe, emit)
- Private instance variables: None (all properties public for testing)

## Canonical Usage Samples

`test/sample/` is the canonical usage reference; the README links it by absolute GitHub URL because `test/` is not in the published tarball.

- Samples import `@stonyx/events`, never `src/`, so they exercise the built `dist/` entry a consumer installs. Each sample exports functions only and has no top-level side effects.
- `test/unit/sample-test.ts` runs every sample and asserts what its handlers observed.
- `test/unit/sample-surface-test.ts` fails if a runtime export is not imported by any sample, if a sample is not imported by any `*-test.ts`, if a sample imports an unexported subpath of `@stonyx/events` or a relative path outside `test/sample/`, or if an export subpath stops resolving to `dist/`. It counts only the imports left after TypeScript compiles the file, so `import type`, `import { type X }`, an unused import, and an import in a comment or string do not count. It reads `package.json` from the working directory, so it runs unchanged in other Stonyx library repos, including ones that run tests from compiled output.
- `pnpm typecheck`, which `pnpm test` runs, type-checks the type imports samples make (such as `EventCallback`). Nothing requires a sample to import each type-only export.
- Adding an export means adding it to a sample.

## Package Exports

### Default Export

```javascript
import Events from '@stonyx/events';
```

The Events class.

### Named Convenience Exports

```javascript
import { setup, subscribe, once, unsubscribe, emit, clear, reset } from '@stonyx/events';
```

All convenience functions use a singleton Events instance internally, providing a cleaner API without needing to instantiate the class.

### Usage Pattern

```javascript
// Create/get singleton instance
const events = new Events();

// Register events
events.setup(['userLogin', 'userLogout']);

// Subscribe
events.subscribe('userLogin', (user) => {
  console.log('User logged in:', user);
});

// Emit (fire-and-forget, don't await)
events.emit('userLogin', { id: 1, name: 'Alice' });

// Or await if you need to ensure all handlers complete
await events.emit('userLogin', { id: 1, name: 'Alice' });
```

### Convenience Exports Usage

```javascript
import { setup, subscribe, emit } from '@stonyx/events';
setup(['myEvent']);
subscribe('myEvent', handler);
emit('myEvent', data);
```

## Common Pitfalls & Gotchas

### Singleton Behavior
- **Issue**: Creating new Events() always returns the same instance
- **Solution**: Don't rely on local variables; singleton ensures shared state
- **Testing**: Always call `reset()` between tests to clear state

### Async Handling
- **Issue**: Forgetting to await emit() can lead to race conditions
- **Solution**: Use `await events.emit()` when order matters
- **Note**: For fire-and-forget, omit await (e.g., in synchronous createRecord)

### Error Isolation
- **Issue**: One handler error doesn't stop other handlers, but logs to console
- **Solution**: Expect console.error output in tests with failing handlers
- **Testing**: Suppress console.error when testing error isolation

### Event Registration
- **Issue**: Subscribing to unregistered events throws an error
- **Solution**: Always call `setup()` with event names before subscribing
- **Why**: Prevents typos and ensures explicit event declarations

### Set-based Subscriptions
- **Issue**: Adding the same callback function twice only subscribes once
- **Solution**: Use different function instances for multiple subscriptions
- **Note**: This is by design to prevent accidental duplicate subscriptions

### Behaviour at the Boundaries
- `emit()` never rejects: handler errors are caught, logged with `console.error`, and swallowed. Awaiting it waits for handlers; it does not surface their errors
- Handlers start in subscription order (`Set` insertion order) and run concurrently; order is not a documented contract
- `once()` subscribes a wrapper that unsubscribes itself before calling the callback, so a `once` handler that emits the same event does not fire again. To cancel a `once` early, call the function `once()` returns; `unsubscribe(event, callback)` with the original callback does not match the wrapper
- `unsubscribe()` on an unknown event or callback is a no-op
- `clear(event)` keeps the registration, so `subscribe` works afterwards without another `setup()`
- `reset()` clears subscribers and registrations; it does not replace the singleton instance
- `setup()` is additive: a second call adds names, it does not replace earlier ones
- The convenience functions and `new Events()` share one singleton, so the two APIs interoperate
- Payloads are untyped: `EventCallback` is `(...args: unknown[]) => void | Promise<void>`, so handlers narrow their own arguments

## Related Resources

- [Stonyx Framework](https://github.com/abofs/stonyx)
- [QUnit Documentation](https://qunitjs.com/)
- [Sinon.js Documentation](https://sinonjs.org/)
- [Node.js ES Modules](https://nodejs.org/api/esm.html)
- [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0)
