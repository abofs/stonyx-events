# @stonyx/events - Project Structure & Architecture

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
│       └── ci.yml              # GitHub Actions CI pipeline
├── .claude/
│   ├── settings.local.json     # Claude Code permissions
│   └── project-structure.md    # This file
├── config/
│   └── environment.js          # Environment configuration
├── src/
│   └── main.js                 # Events class implementation
├── test/
│   └── unit/
│       └── events-test.js      # QUnit tests for Events
├── .gitignore                  # Git ignore patterns
├── .npmignore                  # NPM ignore patterns
├── .nvmrc                      # Node version specification
├── LICENSE.md                  # Apache 2.0 license
├── README.md                   # User-facing documentation
├── package.json                # NPM package configuration
└── stonyx-bootstrap.cjs        # CommonJS bootstrap for testing
```

## Core Components Deep Dive

### Events Class (`src/main.js`)

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

### Direct Dependencies

**stonyx** (file:../stonyx)
- Core Stonyx framework
- Provides base configuration and bootstrapping
- Required for module initialization

### Dev Dependencies

**@stonyx/utils** (file:../stonyx-utils)
- Utility functions (currently unused but available)

**qunit** (^2.24.1)
- Testing framework
- Runs via CLI with stonyx-bootstrap.cjs

**sinon** (^21.0.0)
- Mocking/stubbing library
- Available for advanced testing scenarios

### Modules That Depend on @stonyx/events

**@stonyx/orm**
- Uses Events for CRUD lifecycle hooks
- Fires events: create:before, create:after, update:before, update:after, delete:before, delete:after
- Provides `ormEvents` singleton instance

## Code Patterns & Conventions

### Module System
- ES Modules throughout
- Default export for Events class
- No named exports (single-purpose module)

### Error Handling
- Validation errors throw immediately
- Runtime errors in handlers are caught and logged
- No silent failures

### Logging
- Environment variable: `EVENTS_LOG` (currently unused in implementation)
- Configuration prepared in `config/environment.js`
- Future: Could add debug logging for emit/subscribe events

### Naming Conventions
- Event names: camelCase strings (e.g., 'userLogin', 'dataChange')
- Method names: lowercase verbs (setup, subscribe, emit)
- Private instance variables: None (all properties public for testing)

## Testing Guidelines

### Test Structure
- All tests in `test/unit/events-test.js`
- QUnit module: `[Unit] Events`
- 18 test cases covering all functionality
- Each test calls `events.reset()` before and after

### Test Patterns

**Singleton Isolation**
```javascript
const events = new Events();
events.reset(); // Clear any previous state
// ... test code ...
events.reset(); // Clean up after test
```

**Async Testing**
```javascript
test('description', async function (assert) {
  // Use async/await for emit()
  await events.emit('event');
  assert.ok(condition);
});
```

**Error Suppression**
```javascript
const originalConsoleError = console.error;
console.error = () => {}; // Suppress expected errors
// ... test code ...
console.error = originalConsoleError; // Restore
```

### Coverage Areas
1. Event registration (setup)
2. Subscription management (subscribe, unsubscribe)
3. Event emission (emit)
4. One-time subscriptions (once)
5. Error isolation
6. Async support
7. Singleton behavior
8. Edge cases (unregistered events, no subscribers)

## Extension Points

While the Events system is intentionally minimal, potential future enhancements include:

### Event Priorities
- Add priority levels for subscribers
- Execute high-priority handlers first
- Use case: Logging before business logic

### Wildcard Events
- Support pattern matching (e.g., 'user:*')
- Subscribe to multiple events at once
- Use case: Debugging, logging all events

### Event History
- Optional recording of emitted events
- Replay functionality for debugging
- Use case: Time-travel debugging, audit logs

### Middleware
- Pre/post-emit hooks
- Event transformation pipeline
- Use case: Validation, logging, metrics

## Configuration Reference

### Environment Variables

**EVENTS_LOG**
- Type: Boolean (truthy/falsy)
- Default: `false`
- Purpose: Enable debug logging (not yet implemented)
- Usage: `EVENTS_LOG=true npm test`

### config/environment.js

```javascript
{
  log: EVENTS_LOG ?? false,  // Debug logging flag
  logColor: '#888',           // Color for log output
}
```

Currently, these config values are prepared but not used in the Events implementation. They provide a foundation for future debug logging features.

## Package Exports

### Main Export

```javascript
import Events from '@stonyx/events';
```

The package exports a single default export: the Events class.

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

## Development Workflow

### Local Development

1. **Install dependencies**
   ```bash
   cd /Users/mstonepc/Repos/abofs
   ./linker.sh local  # Link all local Stonyx modules
   cd stonyx-events
   npm install
   ```

2. **Run tests**
   ```bash
   npm test
   ```

3. **Make changes**
   - Edit `src/main.js` for implementation
   - Edit `test/unit/events-test.js` for tests
   - Follow TDD: Write failing test, implement feature, verify

### Test-Driven Development

The module follows TDD principles:
1. Write a failing test for new functionality
2. Implement the minimum code to pass the test
3. Refactor while keeping tests green
4. Ensure all tests pass before committing

### CI/CD Pipeline

**GitHub Actions** (`.github/workflows/ci.yml`)
- Triggers on PRs to `dev` and `main` branches
- Uses pnpm for package management
- Runs `pnpm test` to verify all tests pass
- Cancels previous runs on new commits

### Publishing Workflow

1. **Version bump**
   ```bash
   npm version patch|minor|major
   ```

2. **Publish to NPM**
   ```bash
   npm publish
   ```

3. **Update dependents**
   - Update `@stonyx/orm` to use published version
   - Update other modules as needed

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

## Future Enhancement Opportunities

### Performance Optimizations
- Lazy initialization of event subscriber sets
- Debouncing/throttling for high-frequency events
- Event batching for bulk updates

### Developer Experience
- TypeScript definitions for type-safe event names and payloads
- Debug mode with detailed logging
- Event visualization/monitoring tools

### Advanced Features
- Event namespacing (e.g., 'user:login:success')
- Event bubbling/capturing (DOM-like event propagation)
- Async middleware pipeline
- Event replay for debugging

### Integration
- Automatic event logging to @stonyx/logger (when it exists)
- Metrics/telemetry integration
- Event persistence for audit trails

## Related Resources

- [Stonyx Framework](https://github.com/abofs/stonyx)
- [QUnit Documentation](https://qunitjs.com/)
- [Sinon.js Documentation](https://sinonjs.org/)
- [Node.js ES Modules](https://nodejs.org/api/esm.html)
- [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0)

---

This document is maintained by the Stonyx team and should be updated whenever architectural changes are made to the @stonyx/events module.
