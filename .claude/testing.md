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

## Canonical Usage Samples
- `test/sample/*.ts` are the canonical usage reference linked from the README. They import `@stonyx/events` (never `src/`) and export functions with no top-level side effects.
- `test/unit/sample-test.ts` runs each sample and asserts what its handlers observed. Samples resolve the built `dist/` entry, so `pnpm test` runs `pnpm build` first.
- `test/unit/sample-surface-test.ts` fails if a runtime export is not imported by any sample, if a sample is not imported by any `*-test.ts`, or if an export subpath stops resolving to `dist/`. Adding an export means adding it to a sample.
