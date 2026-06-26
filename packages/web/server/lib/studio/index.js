/**
 * StudioOS — Composition root.
 *
 * Creates the StudioOS runtime by composing all submodules.
 * Follows the pattern of scheduled-tasks/runtime.js and other server modules.
 */

import { createEventBus } from './runtime/event-bus.js';
import { createStateMachine } from './runtime/state-machine.js';
import { createScheduler } from './runtime/scheduler.js';
import { createTaskQueue } from './runtime/task-queue.js';
import { createSupervisor } from './runtime/supervisor.js';
import { createIdentitySystem } from './identity/identity.js';
import { createOrchestrator } from './orchestrator.js';
import { createOrganizationManager } from './organization.js';
import { createPersistence } from './persistence.js';
import { createOpenCodeExecutionProvider } from './execution/opencode-provider.js';
import { bridgeEvents } from './events.js';

/**
 * Create the StudioOS runtime.
 *
 * @param {Object} options
 * @param {Object} options.opencodeClient - OpenCode SDK wrapper
 * @param {Object} options.gitService - Git service for worktrees
 * @param {Object} options.eventHub - SSE event hub (from event-stream)
 * @param {Object} options.projectConfig - Project config for persistence paths
 * @param {string} options.configDir - Config directory (~/.config/openchamber)
 * @returns {StudioRuntime}
 */
export function createStudioRuntime(options = {}) {
  const {
    opencodeClient,
    gitService,
    eventHub,
    projectConfig,
    configDir = process.env.HOME ? `${process.env.HOME}/.config/openchamber` : './config',
  } = options;

  // 1. Infrastructure
  const persistence = createPersistence({ configDir });
  const eventBus = createEventBus();

  // 2. State machine
  const stateMachine = createStateMachine(eventBus);

  // 3. Scheduler
  const scheduler = createScheduler(eventBus);

  // 4. Execution provider
  const executionProvider = createOpenCodeExecutionProvider({
    opencodeClient,
    gitService,
    eventBus,
  });

  // 5. Supervisor
  const supervisor = createSupervisor({
    eventBus,
    executionProvider,
  });

  // 6. Task queue
  const taskQueue = createTaskQueue({
    maxConcurrency: options.maxConcurrency || 3,
    eventBus,
    executionProvider,
  });

  // 7. Identity system
  const identitySystem = createIdentitySystem({
    persistence,
  });

  // 8. Orchestrator
  const orchestrator = createOrchestrator({
    eventBus,
    stateMachine,
    scheduler,
    taskQueue,
    supervisor,
    executionProvider,
    identitySystem,
    persistence,
  });

  // 9. Organization manager
  const orgManager = createOrganizationManager({
    persistence,
    identitySystem,
    executionProvider,
    eventBus,
  });

  // 10. Bridge internal events → external SSE hub
  const unsubscribeBridge = bridgeEvents(eventBus, eventHub);

  // 11. Start supervisor monitoring
  supervisor.startMonitor(10000);

  // ─── Public API ───

  /**
   * Submit a task to the organization.
   */
  async function submitTask(projectId, prompt, options = {}) {
    return orchestrator.submitTask(projectId, prompt, options);
  }

  function cancelTask(taskId) {
    return orchestrator.cancelTask(taskId);
  }

  function listTasks(projectId) {
    return orchestrator.listTasks(projectId);
  }

  function getTask(projectId, taskId) {
    return orchestrator.getTask(projectId, taskId);
  }

  function getOrganization(projectId) {
    return orgManager.getOrganization(projectId);
  }

  function updateOrganization(projectId, updates) {
    return orgManager.updateOrganization(projectId, updates);
  }

  function createProject(projectId, name, workspaceDirectory) {
    return orgManager.createProject(projectId, name, workspaceDirectory);
  }

  function deleteOrganization(projectId) {
    return orgManager.deleteOrganization(projectId);
  }

  function listAgentIdentities(projectId) {
    return identitySystem.list(projectId);
  }

  function getAgentIdentity(projectId, instanceId) {
    return identitySystem.load(projectId, instanceId);
  }

  /**
   * Stop the StudioOS runtime.
   */
  function stop() {
    scheduler.stop();
    supervisor.stopMonitor();
    unsubscribeBridge();
    eventBus.clear();
  }

  return {
    // Core
    eventBus,
    taskQueue,
    executionProvider,

    // Organization
    createProject,
    getOrganization,
    updateOrganization,
    deleteOrganization,

    // Tasks
    submitTask,
    cancelTask,
    listTasks,
    getTask,

    // Identities
    listAgentIdentities,
    getAgentIdentity,

    // Lifecycle
    stop,
  };
}

/**
 * @typedef {Object} StudioRuntime
 * @property {import('./runtime/event-bus.js').EventBus} eventBus
 * @property {import('./runtime/task-queue.js').TaskQueue} taskQueue
 * @property {import('./execution/provider.js').ExecutionProvider} executionProvider
 * @property {(projectId: string, name: string, workspaceDirectory: string) => Promise<Object>} createProject
 * @property {(projectId: string) => Promise<Object|null>} getOrganization
 * @property {(projectId: string, updates: Object) => Promise<Object>} updateOrganization
 * @property {(projectId: string) => Promise<void>} deleteOrganization
 * @property {(projectId: string, prompt: string, options?: Object) => Promise<Object>} submitTask
 * @property {(taskId: string) => Promise<void>} cancelTask
 * @property {(projectId: string) => Promise<Array>} listTasks
 * @property {(projectId: string, taskId: string) => Promise<Object|null>} getTask
 * @property {(projectId: string) => Promise<Array>} listAgentIdentities
 * @property {(projectId: string, instanceId: string) => Promise<Object|null>} getAgentIdentity
 * @property {() => void} stop
 */
