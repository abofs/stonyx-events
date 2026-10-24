/**
 * Canonical usage of the Events class (the package's default export).
 *
 * Every `new Events()` returns the same singleton that backs the convenience
 * functions, so instances and convenience functions share one registry.
 * Nothing runs at import time.
 */
import Events from '@stonyx/events';
import type { EventCallback } from '@stonyx/events';

/** The instance methods mirror the convenience functions one-for-one. */
export async function useInstanceMethods(): Promise<string[]> {
  const seen: string[] = [];
  const events = new Events();

  events.setup(['userLogin', 'userLogout']);

  const onLogout: EventCallback = (user) => {
    seen.push(`logout:${user as string}`);
  };

  const stopLogin = events.subscribe('userLogin', (user) => {
    seen.push(`login:${user as string}`);
  });
  events.once('userLogin', (user) => {
    seen.push(`first-login:${user as string}`);
  });
  events.subscribe('userLogout', onLogout);

  await events.emit('userLogin', 'alice');
  await events.emit('userLogin', 'bob');
  stopLogin();
  await events.emit('userLogin', 'carol'); // no subscribers left

  await events.emit('userLogout', 'alice');
  events.unsubscribe('userLogout', onLogout);
  await events.emit('userLogout', 'bob'); // unsubscribed

  events.subscribe('userLogout', onLogout);
  events.clear('userLogout');
  await events.emit('userLogout', 'dave'); // cleared

  events.reset();

  return seen;
}

/** Two instances are the same object, so one can register and the other can subscribe. */
export async function shareOneRegistry(): Promise<{ sameInstance: boolean; received: string[] }> {
  const received: string[] = [];

  const producer = new Events();
  const consumer = new Events();

  producer.setup(['orderPlaced']);
  consumer.subscribe('orderPlaced', (orderId) => {
    received.push(orderId as string);
  });

  await producer.emit('orderPlaced', 'order-1');

  return { sameInstance: producer === consumer, received };
}
