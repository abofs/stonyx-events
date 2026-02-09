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
│       └── ci.yml              # GitHub Actions CI pipeline
├── .claude/
│   ├── settings.local.json     # Claude Code permissions
│   ├── index.md                # This file
│   └── testing.md              # Testing guidelines
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
└── package.json                # NPM package configuration
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
- Runs via `stonyx test`

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

## Convenience Exports (v0.1.1-alpha.1+)

**Status**: Fully Implemented

The package now exports convenience functions that use the singleton instance directly, providing a cleaner API for consumers.

### Exported Functions

All convenience functions are re-exported from `src/main.js`:

```javascript
// Create singleton instance
const events = new Events();

// Export convenience functions that use the singleton
export const setup = (...args) => events.setup(...args);
export const subscribe = (...args) => events.subscribe(...args);
export const once = (...args) => events.once(...args);
export const unsubscribe = (...args) => events.unsubscribe(...args);
export const emit = (...args) => events.emit(...args);
export const clear = (...args) => events.clear(...args);
export const reset = (...args) => events.reset(...args);
```

### Usage Comparison

**Before (Class-based)**:
```javascript
import Events from '@stonyx/events';
const events = new Events();
events.setup(['myEvent']);
events.subscribe('myEvent', handler);
events.emit('myEvent', data);
```

**After (Convenience exports)**:
```javascript
import { setup, subscribe, emit } from '@stonyx/events';
setup(['myEvent']);
subscribe('myEvent', handler);
emit('myEvent', data);
```

### Benefits

1. **Cleaner API**: No need to instantiate Events class
2. **Less Boilerplate**: Direct function imports
3. **Singleton Pattern**: Still uses single instance internally
4. **Backward Compatible**: Class-based usage still works
5. **Better DX**: More intuitive for developers

### Integration with Stonyx ORM

The ORM now uses these convenience exports for its hooks system:

```javascript
// In stonyx-orm/src/main.js
import { setup } from '@stonyx/events';
setup(eventNames); // Register all hook events

// In stonyx-orm/src/orm-request.js
import { emit } from '@stonyx/events';
await emit(`before:${operation}:${this.model}`, context);
```

### Migration Guide

No breaking changes - both APIs work:

**Option 1: Use convenience exports (recommended)**
```javascript
import { subscribe, emit } from '@stonyx/events';
subscribe('myEvent', handler);
emit('myEvent', data);
```

**Option 2: Use Events class (still supported)**
```javascript
import Events from '@stonyx/events';
const events = new Events(); // Returns singleton
events.subscribe('myEvent', handler);
events.emit('myEvent', data);
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

## Related Resources

- [Stonyx Framework](https://github.com/abofs/stonyx)
- [QUnit Documentation](https://qunitjs.com/)
- [Sinon.js Documentation](https://sinonjs.org/)
- [Node.js ES Modules](https://nodejs.org/api/esm.html)
- [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0)
