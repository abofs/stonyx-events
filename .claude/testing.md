# @stonyx/events - Testing Guidelines

## Test Structure
- All tests in `test/unit/events-test.js`
- QUnit module: `[Unit] Events`
- 17 test cases covering all functionality
- Each test calls `events.reset()` before and after

## Test Patterns

### Singleton Isolation
```javascript
const events = new Events();
events.reset(); // Clear any previous state
// ... test code ...
events.reset(); // Clean up after test
```

### Async Testing
```javascript
test('description', async function (assert) {
  // Use async/await for emit()
  await events.emit('event');
  assert.ok(condition);
});
```

### Error Suppression
```javascript
const originalConsoleError = console.error;
console.error = () => {}; // Suppress expected errors
// ... test code ...
console.error = originalConsoleError; // Restore
```

## Coverage Areas
1. Event registration (setup)
2. Subscription management (subscribe, unsubscribe)
3. Event emission (emit)
4. One-time subscriptions (once)
5. Error isolation
6. Async support
7. Singleton behavior
8. Edge cases (unregistered events, no subscribers)
