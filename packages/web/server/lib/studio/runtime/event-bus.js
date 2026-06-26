/**
 * Event Bus — Internal event distribution for StudioOS.
 *
 * The nervous system of the organization. Components publish and subscribe
 * to events without knowing each other. Also bridges to external SSE.
 */

export function createEventBus() {
  /** @type {Map<string, Set<Function>>} */
  const listeners = new Map();

  /** @type {Array<{event: string, payload: any, timestamp: number}>} */
  const history = [];
  const MAX_HISTORY = 1000;

  /** @type {Set<Function>} */
  const wildcardListeners = new Set();

  /**
   * Subscribe to a specific event.
   * @param {string} event
   * @param {(event: string, payload: any) => void} handler
   * @returns {() => void} unsubscribe
   */
  function subscribe(event, handler) {
    if (event === '*') {
      wildcardListeners.add(handler);
      return () => wildcardListeners.delete(handler);
    }
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(handler);
    return () => listeners.get(event).delete(handler);
  }

  /**
   * Subscribe to ALL events (wildcard).
   * @param {(event: string, payload: any) => void} handler
   * @returns {() => void} unsubscribe
   */
  function subscribeAll(handler) {
    return subscribe('*', handler);
  }

  /**
   * Publish an event to all subscribers.
   * @param {string} event
   * @param {any} payload
   */
  function publish(event, payload) {
    const entry = { event, payload, timestamp: Date.now() };
    history.push(entry);
    if (history.length > MAX_HISTORY) history.shift();

    const handlers = listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event, payload);
        } catch (err) {
          console.error(`[studio:event-bus] Handler failed for "${event}":`, err);
        }
      }
    }

    for (const handler of wildcardListeners) {
      try {
        handler(event, payload);
      } catch (err) {
        console.error(`[studio:event-bus] Wildcard handler failed for "${event}":`, err);
      }
    }
  }

  /**
   * Get recent event history for replay on reconnect.
   * @param {number} [since] - Timestamp to filter from
   * @returns {Array<{event: string, payload: any, timestamp: number}>}
   */
  function getHistory(since) {
    if (!since) return [...history];
    return history.filter(e => e.timestamp > since);
  }

  /**
   * Remove all listeners.
   */
  function clear() {
    listeners.clear();
    wildcardListeners.clear();
  }

  return {
    subscribe,
    subscribeAll,
    publish,
    getHistory,
    clear,
  };
}

/** @typedef {ReturnType<typeof createEventBus>} EventBus */
