/**
 * Canonical usage of the @stonyx/events convenience functions.
 *
 * Every function here is a self-contained recipe: it registers the events it
 * needs, wires handlers, emits, and returns what the handlers observed so a
 * test can assert on it. Nothing runs at import time.
 */
import { setup, subscribe, once, unsubscribe, emit, clear, reset } from '@stonyx/events';

interface User {
  name: string;
}

/** Register events, subscribe, emit, then remove the handler with the returned function. */
export async function subscribeAndUnsubscribe(): Promise<string[]> {
  const logins: string[] = [];

  setup(['userLogin', 'userLogout']);

  const stopListening = subscribe('userLogin', (user) => {
    logins.push((user as User).name);
  });

  await emit('userLogin', { name: 'Alice' });
  stopListening();
  await emit('userLogin', { name: 'Bob' }); // no subscriber left, nobody hears this

  return logins;
}

/** A once() handler fires on the first emit only. */
export async function subscribeOnce(): Promise<number> {
  let firstChangeCount = 0;

  setup(['dataChange']);
  once('dataChange', () => {
    firstChangeCount++;
  });

  await emit('dataChange');
  await emit('dataChange');

  return firstChangeCount;
}

/** unsubscribe() removes a handler by reference, without keeping the returned function. */
export async function unsubscribeByReference(): Promise<number> {
  let calls = 0;
  const onLogout = (): void => {
    calls++;
  };

  setup(['userLogout']);
  subscribe('userLogout', onLogout);

  await emit('userLogout');
  unsubscribe('userLogout', onLogout);
  await emit('userLogout');

  return calls;
}

/** emit() returns a promise that settles after every async handler has finished. */
export async function awaitAsyncHandlers(): Promise<string[]> {
  const saved: string[] = [];

  setup(['dataChange']);
  subscribe('dataChange', async (record) => {
    await new Promise((resolve) => setImmediate(resolve));
    saved.push(record as string);
  });

  await emit('dataChange', 'record-1');

  return saved; // already populated: emit awaited the handler
}

/** A throwing handler is logged and isolated; the other handlers still run. */
export async function isolateHandlerErrors(): Promise<string[]> {
  const ran: string[] = [];

  setup(['dataChange']);
  subscribe('dataChange', () => {
    throw new Error('handler failed');
  });
  subscribe('dataChange', () => {
    ran.push('healthy handler');
  });

  await emit('dataChange');

  return ran;
}

/** clear() drops every subscriber of one event; the event stays registered. */
export async function clearEvent(): Promise<{ calls: number; canResubscribe: boolean }> {
  let calls = 0;

  setup(['dataChange']);
  subscribe('dataChange', () => calls++);
  subscribe('dataChange', () => calls++);

  clear('dataChange');
  await emit('dataChange');

  const stop = subscribe('dataChange', () => {}); // still registered, so this does not throw
  stop();

  return { calls, canResubscribe: true };
}

/** reset() drops every subscriber and every registration, e.g. between tests. */
export function resetEverything(): string | null {
  setup(['userLogin']);
  subscribe('userLogin', () => {});

  reset();

  try {
    subscribe('userLogin', () => {});
    return null;
  } catch (error) {
    return (error as Error).message; // userLogin must be set up again after a reset
  }
}
