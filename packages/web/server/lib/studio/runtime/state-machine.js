/**
 * State Machine — Valid transitions for tasks and agents.
 *
 * Centralizes all state transition rules so the orchestrator
 * never has to reason about what transitions are valid.
 */

/** @typedef {import('../types.js').TaskStatus} TaskStatus */

const TASK_TRANSITIONS = {
  pending: ['decomposing'],
  decomposing: ['assigned', 'failed'],
  assigned: ['in_progress', 'failed'],
  in_progress: ['completed', 'failed'],
  completed: [],
  failed: ['pending', 'blocked'],
  blocked: ['pending', 'cancelled'],
  cancelled: [],
};

const AGENT_TRANSITIONS = {
  idle: ['spawning'],
  spawning: ['executing', 'error'],
  executing: ['completed', 'error'],
  waiting: ['executing', 'error'],
  completed: ['idle'],
  error: ['idle'],
};

/**
 * Create a state machine for tasks and agents.
 * @param {import('./event-bus.js').EventBus} eventBus
 */
export function createStateMachine(eventBus) {

  function validateTaskTransition(currentStatus, newStatus) {
    const allowed = TASK_TRANSITIONS[currentStatus];
    if (!allowed) {
      return { valid: false, error: `Unknown status: "${currentStatus}"` };
    }
    if (!allowed.includes(newStatus)) {
      return {
        valid: false,
        error: `Invalid task transition: "${currentStatus}" → "${newStatus}". Allowed: ${allowed.join(', ') || '(terminal)'}`,
      };
    }
    return { valid: true };
  }

  function validateAgentTransition(currentState, newState) {
    const allowed = AGENT_TRANSITIONS[currentState];
    if (!allowed) {
      return { valid: false, error: `Unknown agent state: "${currentState}"` };
    }
    if (!allowed.includes(newState)) {
      return {
        valid: false,
        error: `Invalid agent transition: "${currentState}" → "${newState}".`,
      };
    }
    return { valid: true };
  }

  /**
   * Transition a task to a new status. Throws on invalid transitions.
   * @param {import('../types.js').Task} task
   * @param {TaskStatus} newStatus
   * @returns {import('../types.js').Task}
   */
  function transitionTask(task, newStatus) {
    const validation = validateTaskTransition(task.status, newStatus);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    task.status = newStatus;
    eventBus.publish('task.status_changed', { taskId: task.id, status: newStatus, previous: task.status });
    return task;
  }

  /**
   * Transition an agent instance to a new state.
   * @param {import('../types.js').AgentInstance} agent
   * @param {string} newState
   * @returns {import('../types.js').AgentInstance}
   */
  function transitionAgent(agent, newState) {
    const validation = validateAgentTransition(agent.state, newState);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    agent.state = newState;
    agent.lastActivityAt = Date.now();
    eventBus.publish('agent.state_changed', { agentId: agent.id, state: newState, previous: agent.state });
    return agent;
  }

  return {
    transitionTask,
    transitionAgent,
    validateTaskTransition,
    validateAgentTransition,
    TASK_TRANSITIONS,
    AGENT_TRANSITIONS,
  };
}
