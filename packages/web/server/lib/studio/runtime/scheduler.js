/**
 * Scheduler — Delayed actions for StudioOS.
 *
 * Manages timeouts, retry backoff, agent wake-ups, and any other
 * time-based operations. Uses a priority queue (min-heap by deadline).
 */

/**
 * @typedef {Object} ScheduledEntry
 * @property {string} id
 * @property {'timeout'|'retry'|'wake_up'|'custom'} type
 * @property {string} [taskId]
 * @property {string} [agentId]
 * @property {number} deadline
 * @property {Object} [data]
 */

/**
 * Create the scheduler.
 * @param {import('./event-bus.js').EventBus} eventBus
 */
export function createScheduler(eventBus) {
  /** @type {ScheduledEntry[]} (sorted by deadline ascending) */
  const queue = [];

  let timer = null;
  let nextId = 0;

  function generateId() {
    return `sch_${Date.now()}_${++nextId}`;
  }

  /**
   * Schedule an entry.
   * @param {ScheduledEntry} entry
   * @returns {string} entry id
   */
  function scheduleEntry(entry) {
    entry.id = generateId();
    // Insert sorted by deadline
    const insertAt = queue.findIndex(e => e.deadline > entry.deadline);
    if (insertAt === -1) {
      queue.push(entry);
    } else {
      queue.splice(insertAt, 0, entry);
    }
    reschedule();
    return entry.id;
  }

  function reschedule() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (queue.length === 0) return;

    const next = queue[0];
    const wait = Math.max(0, next.deadline - Date.now());

    if (wait <= 0) {
      // Due now — process immediately
      queue.shift();
      eventBus.publish('scheduler.due', next);
      reschedule();
      return;
    }

    timer = setTimeout(() => {
      const due = queue.shift();
      if (due) {
        eventBus.publish('scheduler.due', due);
      }
      reschedule();
    }, wait);
  }

  /**
   * Cancel a scheduled entry.
   * @param {string} id
   */
  function cancel(id) {
    const idx = queue.findIndex(e => e.id === id);
    if (idx >= 0) {
      queue.splice(idx, 1);
      reschedule();
    }
  }

  /**
   * Schedule a task timeout.
   * @param {string} taskId
   * @param {number} timeoutMs - Milliseconds until timeout
   * @returns {string} schedule id
   */
  function scheduleTimeout(taskId, timeoutMs) {
    return scheduleEntry({
      id: '',
      type: 'timeout',
      taskId,
      deadline: Date.now() + timeoutMs,
      data: { timeoutMs },
    });
  }

  /**
   * Schedule a retry with exponential backoff.
   * @param {string} taskId
   * @param {number} attempt - Which attempt (1-based)
   * @param {number} [baseDelayMs=10000]
   * @returns {string}
   */
  function scheduleRetry(taskId, attempt, baseDelayMs = 10000) {
    const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), 300000); // max 5 min
    return scheduleEntry({
      id: '',
      type: 'retry',
      taskId,
      deadline: Date.now() + delay,
      data: { attempt, delay },
    });
  }

  /**
   * Schedule an agent wake-up.
   * @param {string} agentId
   * @param {number} delayMs
   * @returns {string}
   */
  function scheduleWakeUp(agentId, delayMs) {
    return scheduleEntry({
      id: '',
      type: 'wake_up',
      agentId,
      deadline: Date.now() + delayMs,
      data: {},
    });
  }

  /**
   * Stop all timers and clear the queue.
   */
  function stop() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    queue.length = 0;
  }

  /**
   * Get pending entries.
   * @returns {ScheduledEntry[]}
   */
  function getPending() {
    return [...queue];
  }

  return {
    scheduleTimeout,
    scheduleRetry,
    scheduleWakeUp,
    cancel,
    stop,
    getPending,
  };
}
