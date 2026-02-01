import QUnit from 'qunit';
import Events from '../../src/main.js';

const { module, test } = QUnit;

module('[Unit] Events', function () {

test('Events: setup() registers event names', function (assert) {
  const events = new Events();
  events.reset();

  events.setup(['testEvent1', 'testEvent2']);

  assert.ok(events.registeredEvents.has('testEvent1'), 'testEvent1 is registered');
  assert.ok(events.registeredEvents.has('testEvent2'), 'testEvent2 is registered');
  assert.strictEqual(events.registeredEvents.size, 2, 'Two events are registered');

  events.reset();
});

test('Events: setup() throws on invalid input', function (assert) {
  const events = new Events();
  events.reset();

  assert.throws(
    () => events.setup('not-an-array'),
    /setup\(\) requires an array/,
    'Throws error for non-array input'
  );

  assert.throws(
    () => events.setup([123]),
    /Event names must be strings/,
    'Throws error for non-string event names'
  );

  events.reset();
});

test('Events: subscribe() adds callbacks', function (assert) {
  const events = new Events();
  events.reset();

  events.setup(['testEvent']);

  const callback1 = () => {};
  const callback2 = () => {};

  events.subscribe('testEvent', callback1);
  events.subscribe('testEvent', callback2);

  const subscribers = events.events.get('testEvent');
  assert.strictEqual(subscribers.size, 2, 'Two callbacks subscribed');
  assert.ok(subscribers.has(callback1), 'callback1 is subscribed');
  assert.ok(subscribers.has(callback2), 'callback2 is subscribed');

  events.reset();
});

test('Events: subscribe() throws for unregistered events', function (assert) {
  const events = new Events();
  events.reset();

  assert.throws(
    () => events.subscribe('unregisteredEvent', () => {}),
    /Event "unregisteredEvent" is not registered/,
    'Throws error for unregistered event'
  );

  events.reset();
});

test('Events: subscribe() throws for non-function callbacks', function (assert) {
  const events = new Events();
  events.reset();

  events.setup(['testEvent']);

  assert.throws(
    () => events.subscribe('testEvent', 'not-a-function'),
    /Callback must be a function/,
    'Throws error for non-function callback'
  );

  events.reset();
});

test('Events: emit() calls all subscribed callbacks', async function (assert) {
  const events = new Events();
  events.reset();

  events.setup(['testEvent']);

  let call1 = false;
  let call2 = false;
  let receivedData = null;

  events.subscribe('testEvent', (data) => {
    call1 = true;
    receivedData = data;
  });

  events.subscribe('testEvent', () => {
    call2 = true;
  });

  await events.emit('testEvent', { value: 42 });

  assert.ok(call1, 'First callback was called');
  assert.ok(call2, 'Second callback was called');
  assert.deepEqual(receivedData, { value: 42 }, 'Callback received correct data');

  events.reset();
});

test('Events: emit() supports async handlers', async function (assert) {
  const events = new Events();
  events.reset();

  events.setup(['testEvent']);

  let asyncComplete = false;

  events.subscribe('testEvent', async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    asyncComplete = true;
  });

  await events.emit('testEvent');

  assert.ok(asyncComplete, 'Async handler completed');

  events.reset();
});

test('Events: emit() isolates errors per handler', async function (assert) {
  const events = new Events();
  events.reset();

  events.setup(['testEvent']);

  let handler1Called = false;
  let handler2Called = false;
  let handler3Called = false;

  events.subscribe('testEvent', () => {
    handler1Called = true;
  });

  events.subscribe('testEvent', () => {
    handler2Called = true;
    throw new Error('Handler 2 failed');
  });

  events.subscribe('testEvent', () => {
    handler3Called = true;
  });

  // Suppress console.error during test
  const originalConsoleError = console.error;
  console.error = () => {};

  await events.emit('testEvent');

  console.error = originalConsoleError;

  assert.ok(handler1Called, 'Handler 1 was called');
  assert.ok(handler2Called, 'Handler 2 was called (even though it threw)');
  assert.ok(handler3Called, 'Handler 3 was called (despite handler 2 throwing)');

  events.reset();
});

test('Events: once() subscribes and auto-unsubscribes after first emit', async function (assert) {
  const events = new Events();
  events.reset();

  events.setup(['testEvent']);

  let callCount = 0;

  events.once('testEvent', () => {
    callCount++;
  });

  await events.emit('testEvent');
  assert.strictEqual(callCount, 1, 'Callback called on first emit');

  await events.emit('testEvent');
  assert.strictEqual(callCount, 1, 'Callback not called on second emit');

  events.reset();
});

test('Events: once() throws for unregistered events', function (assert) {
  const events = new Events();
  events.reset();

  assert.throws(
    () => events.once('unregisteredEvent', () => {}),
    /Event "unregisteredEvent" is not registered/,
    'Throws error for unregistered event'
  );

  events.reset();
});

test('Events: unsubscribe() removes specific callback', async function (assert) {
  const events = new Events();
  events.reset();

  events.setup(['testEvent']);

  let call1 = false;
  let call2 = false;

  const callback1 = () => {
    call1 = true;
  };
  const callback2 = () => {
    call2 = true;
  };

  events.subscribe('testEvent', callback1);
  events.subscribe('testEvent', callback2);

  events.unsubscribe('testEvent', callback1);

  await events.emit('testEvent');

  assert.notOk(call1, 'Unsubscribed callback1 was not called');
  assert.ok(call2, 'Callback2 was still called');

  events.reset();
});

test('Events: subscribe() returns unsubscribe function', async function (assert) {
  const events = new Events();
  events.reset();

  events.setup(['testEvent']);

  let callCount = 0;

  const unsubscribe = events.subscribe('testEvent', () => {
    callCount++;
  });

  await events.emit('testEvent');
  assert.strictEqual(callCount, 1, 'Callback called before unsubscribe');

  unsubscribe();

  await events.emit('testEvent');
  assert.strictEqual(callCount, 1, 'Callback not called after unsubscribe');

  events.reset();
});

test('Events: clear() removes all subscriptions for an event', async function (assert) {
  const events = new Events();
  events.reset();

  events.setup(['testEvent']);

  let call1 = false;
  let call2 = false;

  events.subscribe('testEvent', () => {
    call1 = true;
  });
  events.subscribe('testEvent', () => {
    call2 = true;
  });

  events.clear('testEvent');

  await events.emit('testEvent');

  assert.notOk(call1, 'Callback1 was not called after clear');
  assert.notOk(call2, 'Callback2 was not called after clear');

  events.reset();
});

test('Events: reset() clears all subscriptions and events', function (assert) {
  const events = new Events();
  events.reset();

  events.setup(['testEvent1', 'testEvent2']);
  events.subscribe('testEvent1', () => {});

  events.reset();

  assert.strictEqual(events.registeredEvents.size, 0, 'No events registered after reset');
  assert.strictEqual(events.events.size, 0, 'No subscriptions after reset');

  events.reset();
});

test('Events: singleton pattern works', function (assert) {
  const events1 = new Events();
  events1.reset();

  events1.setup(['testEvent']);

  const events2 = new Events();

  assert.strictEqual(events1, events2, 'Both instances are the same');
  assert.ok(events2.registeredEvents.has('testEvent'), 'Second instance has same registered events');

  events1.reset();
});

test('Events: emit() does nothing for events with no subscribers', async function (assert) {
  const events = new Events();
  events.reset();

  events.setup(['testEvent']);

  // Should not throw
  await events.emit('testEvent');

  assert.ok(true, 'No error when emitting to event with no subscribers');

  events.reset();
});

test('Events: emit() does nothing for unregistered events', async function (assert) {
  const events = new Events();
  events.reset();

  // Should not throw
  await events.emit('unregisteredEvent');

  assert.ok(true, 'No error when emitting unregistered event');

  events.reset();
});

});
