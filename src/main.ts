/**
 * Events - A lightweight pub/sub event system
 *
 * Provides event subscription and emission with support for:
 * - One-time subscriptions (once)
 * - Async event handlers
 * - Error isolation per handler
 * - Singleton pattern
 */

export type EventCallback = (...args: unknown[]) => void | Promise<void>;

class Events {
  static instance: Events | null = null;

  events: Map<string, Set<EventCallback>> = new Map();
  registeredEvents: Set<string> = new Set();

  constructor() {
    if (Events.instance) {
      return Events.instance;
    }

    Events.instance = this;
  }

  setup(eventNames: string[]): void {
    if (!Array.isArray(eventNames)) {
      throw new Error('setup() requires an array of event names');
    }

    for (const eventName of eventNames) {
      if (typeof eventName !== 'string') {
        throw new Error('Event names must be strings');
      }
      this.registeredEvents.add(eventName);
      if (!this.events.has(eventName)) {
        this.events.set(eventName, new Set());
      }
    }
  }

  subscribe(event: string, callback: EventCallback): () => void {
    if (!this.registeredEvents.has(event)) {
      throw new Error(`Event "${event}" is not registered. Call setup() first.`);
    }

    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    const subscribers = this.events.get(event);
    if (!subscribers) throw new Error(`Event "${event}" subscribers not found in events Map`);
    subscribers.add(callback);

    // Return unsubscribe function
    return () => this.unsubscribe(event, callback);
  }

  once(event: string, callback: EventCallback): () => void {
    if (!this.registeredEvents.has(event)) {
      throw new Error(`Event "${event}" is not registered. Call setup() first.`);
    }

    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    const wrapper = async (...args: unknown[]) => {
      this.unsubscribe(event, wrapper);
      await callback(...args);
    };

    return this.subscribe(event, wrapper);
  }

  unsubscribe(event: string, callback: EventCallback): void {
    if (!this.events.has(event)) {
      return;
    }

    const subscribers = this.events.get(event);
    if (subscribers) subscribers.delete(callback);
  }

  async emit(event: string, ...args: unknown[]): Promise<void> {
    if (!this.events.has(event)) {
      return;
    }

    const subscribers = this.events.get(event);
    if (!subscribers) return;

    // Execute all handlers with error isolation
    const promises = Array.from(subscribers).map(async (callback) => {
      try {
        await callback(...args);
      } catch (error) {
        console.error(`Error in event handler for "${event}":`, error);
      }
    });

    await Promise.all(promises);
  }

  clear(event: string): void {
    this.events.get(event)?.clear();
  }

  reset(): void {
    this.events.clear();
    this.registeredEvents.clear();
  }
}

export default Events;

// Create singleton instance
const events = new Events();

// Export convenience functions that use the singleton
export const setup = (eventNames: string[]): void => events.setup(eventNames);
export const subscribe = (event: string, callback: EventCallback): (() => void) => events.subscribe(event, callback);
export const once = (event: string, callback: EventCallback): (() => void) => events.once(event, callback);
export const unsubscribe = (event: string, callback: EventCallback): void => events.unsubscribe(event, callback);
export const emit = (event: string, ...args: unknown[]): Promise<void> => events.emit(event, ...args);
export const clear = (event: string): void => events.clear(event);
export const reset = (): void => events.reset();
