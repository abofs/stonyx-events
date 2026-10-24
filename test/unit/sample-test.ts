import QUnit from 'qunit';
import sinon from 'sinon';
import Events, { reset } from '@stonyx/events';
import {
  subscribeAndUnsubscribe,
  subscribeOnce,
  unsubscribeByReference,
  awaitAsyncHandlers,
  isolateHandlerErrors,
  clearEvent,
  resetEverything,
} from '../sample/convenience.js';
import { useInstanceMethods, shareOneRegistry } from '../sample/class.js';

const { module, test } = QUnit;

// Samples run against the built package entry, whose singleton is separate
// from the one src/ tests use. Reset it around every sample.
module('[Unit] Samples', function (hooks) {
  hooks.beforeEach(() => reset());
  hooks.afterEach(() => {
    reset();
    sinon.restore();
  });

  module('convenience functions', function () {
    test('subscribe() returns a function that stops delivery', async function (assert) {
      assert.deepEqual(await subscribeAndUnsubscribe(), ['Alice'], 'only the emit before unsubscribing was delivered');
    });

    test('once() fires exactly once across two emits', async function (assert) {
      assert.strictEqual(await subscribeOnce(), 1);
    });

    test('unsubscribe() removes a handler by reference', async function (assert) {
      assert.strictEqual(await unsubscribeByReference(), 1, 'second emit after unsubscribe was not delivered');
    });

    test('emit() resolves after async handlers finish', async function (assert) {
      assert.deepEqual(await awaitAsyncHandlers(), ['record-1']);
    });

    test('a throwing handler is logged and does not stop the others', async function (assert) {
      const consoleError = sinon.stub(console, 'error');

      assert.deepEqual(await isolateHandlerErrors(), ['healthy handler']);
      assert.strictEqual(consoleError.callCount, 1, 'the failure was logged once');
      assert.ok(String(consoleError.firstCall.args[0]).includes('"dataChange"'), 'log names the event');
    });

    test('clear() empties an event but keeps it registered', async function (assert) {
      assert.deepEqual(await clearEvent(), { afterClear: 0, afterResubscribe: 1 });
    });

    test('reset() unregisters every event', function (assert) {
      assert.strictEqual(resetEverything(), 'Event "userLogin" is not registered. Call setup() first.');
    });
  });

  module('Events class', function () {
    test('instance methods: subscribe, once, unsubscribe, clear, reset', async function (assert) {
      assert.deepEqual(await useInstanceMethods(), [
        'login:alice',
        'first-login:alice',
        'login:bob',
        'logout:alice',
      ]);
      assert.strictEqual(new Events().registeredEvents.size, 0, 'events.reset() cleared the registry');
    });

    test('every instance and the convenience functions share one registry', async function (assert) {
      const { sameInstance, received } = await shareOneRegistry();

      assert.true(sameInstance, 'new Events() returns the same object each time');
      assert.deepEqual(received, ['order-1', 'order-2'], 'a subscriber on one instance hears emits from the other instance and from emit()');
    });
  });
});
