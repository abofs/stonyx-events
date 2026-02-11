/**
 * Events - A lightweight pub/sub event system
 *
 * Provides event subscription and emission with support for:
 * - One-time subscriptions (once)
 * - Async event handlers
 * - Error isolation per handler
 * - Singleton pattern
 */

class Events {
  /**
   * Singleton instance
   * @type {Events}
   */
  static instance = null;

  /**
   * Create a new Events instance
   */
  constructor() {
    if (Events.instance) {
      return Events.instance;
    }

    /**
     * Map of event names to their subscribers
     * @type {Map<string, Set<Function>>}
     */
    this.events = new Map();

    /**
     * Set of registered event names
     * @type {Set<string>}
     */
    this.registeredEvents = new Set();

    Events.instance = this;
  }

  /**
   * Register available event names
   * @param {string[]} eventNames - Array of event names to register
   */
  setup(eventNames) {
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

  /**
   * Subscribe to an event
   * @param {string} event - Event name to subscribe to
   * @param {Function} callback - Handler function to call when event fires
   * @returns {Function} Unsubscribe function
   * @throws {Error} If event is not registered
   */
  subscribe(event, callback) {
    if (!this.registeredEvents.has(event)) {
      throw new Error(`Event "${event}" is not registered. Call setup() first.`);
    }

    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    const subscribers = this.events.get(event);
    subscribers.add(callback);

    // Return unsubscribe function
    return () => this.unsubscribe(event, callback);
  }

  /**
   * Subscribe to an event once (auto-unsubscribe after first emit)
   * @param {string} event - Event name to subscribe to
   * @param {Function} callback - Handler function to call when event fires
   * @returns {Function} Unsubscribe function
   * @throws {Error} If event is not registered
   */
  once(event, callback) {
    if (!this.registeredEvents.has(event)) {
      throw new Error(`Event "${event}" is not registered. Call setup() first.`);
    }

    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    const wrapper = async (...args) => {
      this.unsubscribe(event, wrapper);
      await callback(...args);
    };

    return this.subscribe(event, wrapper);
  }

  /**
   * Unsubscribe from an event
   * @param {string} event - Event name to unsubscribe from
   * @param {Function} callback - Handler function to remove
   */
  unsubscribe(event, callback) {
    if (!this.events.has(event)) {
      return;
    }

    const subscribers = this.events.get(event);
    subscribers.delete(callback);
  }

  /**
   * Emit an event with arguments
   * Executes all subscribed handlers asynchronously with error isolation
   * @param {string} event - Event name to emit
   * @param {...any} args - Arguments to pass to handlers
   */
  async emit(event, ...args) {
    if (!this.events.has(event)) {
      return;
    }

    const subscribers = this.events.get(event);

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

  /**
   * Clear all subscriptions for an event
   * @param {string} event - Event name to clear
   */
  clear(event) {
    if (this.events.has(event)) {
      this.events.get(event).clear();
    }
  }

  /**
   * Reset the entire event system (clear all subscriptions)
   * Useful for testing
   */
  reset() {
    this.events.clear();
    this.registeredEvents.clear();
  }
}

export default Events;

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
