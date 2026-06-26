/**
 * Task Queue — Priority queue for worker task execution.
 *
 * Manages concurrency limits (default: 3 parallel workers) and
 * priority ordering. Works with the ExecutionProvider to execute
 * tasks and emit results back through the event bus.
 */

/**
 * Create a task execution queue.
 * @param {Object} options
 * @param {number} [options.maxConcurrency=3]
 * @param {import('./event-bus.js').EventBus} options.eventBus
 * @param {import('../execution/provider.js').ExecutionProvider} options.executionProvider
 */
export function createTaskQueue({ maxConcurrency = 3, eventBus, executionProvider }) {
  /** @type {Map<string, { task: Object, priority: string, createdAt: number }>} */
  const queues = {
    critical: [],
    high: [],
    normal: [],
    low: [],
  };

  /** @type {Map<string, { task: Object, handle: Object }>} */
  const inProgress = new Map();

  let activeCount = 0;

  const PRIORITY_LEVELS = ['critical', 'high', 'normal', 'low'];

  /**
   * Enqueue a task for execution.
   * @param {Object} task - The task to execute
   * @param {'critical'|'high'|'normal'|'low'} [priority='normal']
   * @returns {{ taskId: string, position: number }}
   */
  function enqueue(task, priority = 'normal') {
    queues[priority].push({ task, priority, createdAt: Date.now() });
    processNext();
    const position = Object.values(queues).reduce((sum, q) => sum + q.length, 0);
    return { taskId: task.id, position };
  }

  async function processNext() {
    if (activeCount >= maxConcurrency) return;

    const entry = dequeueHighest();
    if (!entry) return;

    activeCount++;
    inProgress.set(entry.task.id, { task: entry.task });

    eventBus.publish('task.dequeued', { taskId: entry.task.id, priority: entry.priority });

    try {
      const handle = await executionProvider.executeTask({
        agent: entry.task.assignedAgentId || 'studio-worker',
        prompt: entry.task.description || entry.task.title,
        workspaceDirectory: entry.task.worktreePath || '',
        metadata: {
          taskId: entry.task.id,
          studioTask: true,
        },
      });

      const tracked = inProgress.get(entry.task.id);
      if (tracked) tracked.handle = handle;

      eventBus.publish('task.started', {
        taskId: entry.task.id,
        sessionId: handle.sessionId,
      });

      // Stream events
      for await (const execEvent of executionProvider.streamTaskEvents(handle.sessionId)) {
        eventBus.publish('task.activity', {
          taskId: entry.task.id,
          type: execEvent.type,
          data: execEvent.data,
          timestamp: execEvent.timestamp,
        });

        if (execEvent.type === 'completed') {
          eventBus.publish('task.completed', {
            taskId: entry.task.id,
            result: execEvent.data,
          });
          break;
        }

        if (execEvent.type === 'error') {
          eventBus.publish('task.failed', {
            taskId: entry.task.id,
            error: execEvent.data,
          });
          break;
        }
      }
    } catch (err) {
      eventBus.publish('task.failed', {
        taskId: entry.task.id,
        error: err.message || 'Unknown execution error',
      });
    } finally {
      inProgress.delete(entry.task.id);
      activeCount--;
      processNext();
    }
  }

  function dequeueHighest() {
    for (const level of PRIORITY_LEVELS) {
      if (queues[level].length > 0) {
        return queues[level].shift();
      }
    }
    return null;
  }

  /**
   * Cancel a pending or running task.
   * @param {string} taskId
   */
  function cancel(taskId) {
    // Remove from queues
    for (const level of PRIORITY_LEVELS) {
      const idx = queues[level].findIndex(e => e.task.id === taskId);
      if (idx >= 0) {
        queues[level].splice(idx, 1);
        eventBus.publish('task.cancelled', { taskId });
        return;
      }
    }

    // Cancel running task
    const tracked = inProgress.get(taskId);
    if (tracked && tracked.handle) {
      executionProvider.cancelTask(tracked.handle.sessionId).catch(() => {});
      inProgress.delete(taskId);
      activeCount--;
      eventBus.publish('task.cancelled', { taskId });
      processNext();
    }
  }

  /**
   * Get queue status.
   * @returns {{ activeCount: number, maxConcurrency: number, pendingCount: number, inProgress: string[] }}
   */
  function getStatus() {
    return {
      activeCount,
      maxConcurrency,
      pendingCount: Object.values(queues).reduce((sum, q) => sum + q.length, 0),
      inProgress: [...inProgress.keys()],
    };
  }

  return {
    enqueue,
    cancel,
    getStatus,
  };
}
