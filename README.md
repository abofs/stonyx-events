# @stonyx/events

A lightweight pub/sub event system for the Stonyx framework. Provides singleton event management with error isolation, async support, and type-safe event registration.

## Features

- **Event Registration**: Events must be registered with `setup()` before use, ensuring type safety
- **Singleton Pattern**: Single Events instance shared across your application
- **Async Support**: Event handlers can be async functions
- **Error Isolation**: Errors in one handler don't affect others or prevent other handlers from running
- **One-time Subscriptions**: Use `once()` for handlers that should only fire once
- **Unsubscribe**: All subscriptions return an unsubscribe function for cleanup

## Installation

```bash
npm install @stonyx/events
```

## Usage

### Option 1: Convenience Functions (Recommended)

The package exports convenience functions that use a singleton instance:

```javascript
import { setup, subscribe, emit, once } from '@stonyx/events';

// Register available events
setup(['userLogin', 'userLogout', 'dataChange']);

// Subscribe to events
subscribe('userLogin', (user) => {
  console.log(`${user.name} logged in`);
});

// Subscribe once (auto-unsubscribe after first fire)
once('dataChange', () => {
  console.log('Data changed for the first time');
});

// Emit events
emit('userLogin', { name: 'Alice' });

// Unsubscribe
const unsub = subscribe('userLogout', handler);
unsub(); // Remove subscription
```

### Option 2: Class-based (Advanced)

You can also instantiate the Events class directly for more control:

```javascript
import Events from '@stonyx/events';

const events = new Events();

// Register available events
events.setup(['userLogin', 'userLogout', 'dataChange']);

// Subscribe to events
events.subscribe('userLogin', (user) => {
  console.log(`${user.name} logged in`);
});

// Emit events
events.emit('userLogin', { name: 'Alice' });
```

**Note:** The Events class uses a singleton pattern, so all instances share the same event registry.

## API Reference

### Convenience Functions (Exported)

All functions use a singleton Events instance:

| Function | Parameters | Description |
|----------|-----------|-------------|
| `setup()` | `eventNames: string[]` | Register available event names. Events must be registered before subscribing. |
| `subscribe()` | `event: string, callback: Function` | Subscribe to an event. Returns an unsubscribe function. |
| `once()` | `event: string, callback: Function` | Subscribe to an event once. Auto-unsubscribes after first emit. |
| `emit()` | `event: string, ...args` | Trigger an event with arguments. Async function that calls all subscribers. |
| `unsubscribe()` | `event: string, callback: Function` | Remove a specific subscription. |
| `clear()` | `event: string` | Remove all subscriptions for an event. |
| `reset()` | none | Clear all subscriptions and events. Useful for testing. |

### Events Class Methods

If using the class directly, all methods above are available as instance methods:

```javascript
import Events from '@stonyx/events';
const events = new Events();

events.setup(['myEvent']);
events.subscribe('myEvent', handler);
events.emit('myEvent', data);
```

## How It Works

- The `Events` class uses a static `instance` property to enforce a singleton -- every `new Events()` returns the same object
- Event names are held in a `registeredEvents` Set; subscribing to an unregistered name throws immediately, catching typos early
- Subscribers are stored in a `Map<string, Set<Function>>`, so duplicate function references are automatically deduplicated
- `emit()` is async: it maps every subscriber into a `Promise`, wraps each in a try/catch for error isolation, and awaits them all with `Promise.all()`
- `once()` wraps the callback in a self-removing wrapper that calls `unsubscribe` before invoking the original handler

## License

Apache — do what you want, just keep attribution.
