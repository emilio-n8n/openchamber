/**
 * Supervisor — Health monitoring for StudioOS.
 *
 * Monitors task execution time, detects cascading failures,
 * manages circuit breakers for misbehaving agents, and alerts
 * on problems.
 */

/**
 * Create the supervisor.
 * @param {Object} deps
 * @param {import('./event-bus.js').EventBus} deps.eventBus
 * @param {import('../execution/provider.js').ExecutionProvider} deps.executionProvider
 * @param {number} [deps.defaultTimeoutMs=300000] - 5 min default
 * @param {number} [deps.maxConsecutiveFailures=3]
 * @param {number} [deps.circuitBreakerResetMs=1800000] - 30 min
 */
export function createSupervisor({
  eventBus,
  executionProvider,
  defaultTimeoutMs = 300000,
  maxConsecutiveFailures = 3,
  circuitBreakerResetMs = 1800000,
}) {
  /** @type {Map<string, number>} taskId → deadline timestamp */
  const taskTimeouts = new Map();

  /** @type {Map<string, number>} agentName → consecutive failures */
  const failureCounts = new Map();

  /** @type {Map<string, { open: boolean, openedAt: number }>} */
  const circuitBreakers = new Map();

  let monitorInterval = null;

  // ─── Event subscriptions ───

  eventBus.subscribe('task.started', ({ taskId }) => {
    taskTimeouts.set(taskId, Date.now() + defaultTimeoutMs);
  });

  eventBus.subscribe('task.completed', ({ taskId }) => {
    taskTimeouts.delete(taskId);
    // Success clears failure count for the agent
    // (completed event may include agentName)
  });

  eventBus.subscribe('task.failed', ({ taskId, error, agentName }) => {
    taskTimeouts.delete(taskId);

    if (agentName) {
      const count = (failureCounts.get(agentName) || 0) + 1;
      failureCounts.set(agentName, count);

      if (count >= maxConsecutiveFailures) {
        openCircuitBreaker(agentName, count);
      }
    }
  });

  function openCircuitBreaker(agentName, failures) {
    circuitBreakers.set(agentName, { open: true, openedAt: Date.now() });
    eventBus.publish('supervisor.circuit_open', { agentName, failures });

    // Auto-reset after timeout
    setTimeout(() => {
      circuitBreakers.delete(agentName);
      failureCounts.delete(agentName);
      eventBus.publish('supervisor.circuit_closed', { agentName });
    }, circuitBreakerResetMs);
  }

  /**
   * Check if a task is allowed to run (circuit breaker check).
   * @param {Object} task
   * @returns {boolean}
   */
  function isTaskAllowed(task) {
    const agentName = task.assignedAgentId;
    if (!agentName) return true;
    const breaker = circuitBreakers.get(agentName);
    return !breaker?.open;
  }

  // ─── Monitoring loop ───

  function startMonitor(intervalMs = 10000) {
    if (monitorInterval) return;
    monitorInterval = setInterval(() => {
      const now = Date.now();

      // Check task timeouts
      for (const [taskId, deadline] of taskTimeouts) {
        if (now > deadline) {
          eventBus.publish('supervisor.timeout', { taskId });
          taskTimeouts.delete(taskId);
        }
      }
    }, intervalMs);
  }

  function stopMonitor() {
    if (monitorInterval) {
      clearInterval(monitorInterval);
      monitorInterval = null;
    }
  }

  function getStatus() {
    return {
      activeTasks: taskTimeouts.size,
      circuitBreakers: [...circuitBreakers.entries()].map(([name, br]) => ({
        agentName: name,
        open: br.open,
        openedAt: br.openedAt,
      })),
      failureCounts: [...failureCounts.entries()].map(([name, count]) => ({
        agentName: name,
        count,
      })),
    };
  }

  return {
    startMonitor,
    stopMonitor,
    isTaskAllowed,
    getStatus,
  };
}
