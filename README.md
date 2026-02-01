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

```javascript
import Events from '@stonyx/events';

const events = new Events();

// Register available events
events.setup(['userLogin', 'userLogout', 'dataChange']);

// Subscribe to events
events.subscribe('userLogin', (user) => {
  console.log(`${user.name} logged in`);
});

// Subscribe once (auto-unsubscribe after first fire)
events.once('dataChange', () => {
  console.log('Data changed for the first time');
});

// Emit events
events.emit('userLogin', { name: 'Alice' });

// Unsubscribe
const unsub = events.subscribe('userLogout', handler);
unsub(); // Remove subscription
```

## API Reference

| Method | Parameters | Description |
|--------|-----------|-------------|
| `setup()` | `eventNames: string[]` | Register available event names. Events must be registered before subscribing. |
| `subscribe()` | `event: string, callback: Function` | Subscribe to an event. Returns an unsubscribe function. |
| `once()` | `event: string, callback: Function` | Subscribe to an event once. Auto-unsubscribes after first emit. |
| `emit()` | `event: string, ...args` | Trigger an event with arguments. Async function that calls all subscribers. |
| `unsubscribe()` | `event: string, callback: Function` | Remove a specific subscription. |
| `clear()` | `event: string` | Remove all subscriptions for an event. |
| `reset()` | none | Clear all subscriptions and events. Useful for testing. |

## How It Works

The Events class provides a lightweight pub/sub system with the following features:

- **Event Registration**: Events must be registered with `setup()` before use, ensuring type safety
- **Singleton Pattern**: Single Events instance shared across your application
- **Async Support**: Event handlers can be async functions
- **Error Isolation**: Errors in one handler don't affect others or prevent other handlers from running
- **One-time Subscriptions**: Use `once()` for handlers that should only fire once
- **Unsubscribe**: All subscriptions return an unsubscribe function for cleanup

## License

Apache — do what you want, just keep attribution.
