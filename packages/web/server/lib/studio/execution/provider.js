/**
 * ExecutionProvider — Abstraction over execution engines.
 *
 * StudioOS talks to this interface only. OpenCode is the first implementation.
 * Tomorrow: Codex, Claude Code, Devin, A2A, etc.
 *
 * @typedef {import('./provider.js').ExecutionProvider} ExecutionProvider
 */

/**
 * @returns {ExecutionProvider} The contract shape (for JSDoc / documentation)
 */
export function createExecutionProviderContract() {
  return {
    // ─── Task Execution ───
    executeTask: async (/** @type {TaskExecutionRequest} */ request) => {},
    cancelTask: async (/** @type {string} */ taskId) => {},
    getTaskStatus: async (/** @type {string} */ taskId) => {},

    // ─── Streaming ───
    streamTaskEvents: async function* (/** @type {string} */ taskId) {},

    // ─── Agent Management ───
    createAgent: async (/** @type {AgentDefinition} */ definition) => '',
    updateAgent: async (/** @type {string} */ name, /** @type {Partial<AgentDefinition>} */ updates) => {},
    deleteAgent: async (/** @type {string} */ name) => {},
    listAgents: async () => [],

    // ─── Workspace ───
    createWorktree: async (/** @type {WorktreeConfig} */ config) => {},
    removeWorktree: async (/** @type {string} */ worktreeId) => {},
    commitChanges: async (/** @type {string} */ worktreeId, /** @type {string} */ message) => {},
    getWorktreeStatus: async (/** @type {string} */ worktreeId) => {},

    // ─── Capabilities ───
    getCapabilities: async () => ({
      supportsWorktrees: true,
      supportsConcurrentSessions: true,
      maxConcurrentSessions: 5,
      supportedProviders: [],
      supportedFeatures: ['agents', 'worktrees', 'streaming'],
    }),
  };
}

// ─── Type Definitions (JSDoc) ───

/**
 * @typedef {Object} TaskExecutionRequest
 * @property {string} agent - Agent name (e.g. 'studio-global-ceo')
 * @property {string} prompt - The full prompt with context
 * @property {string} workspaceDirectory - Working directory for execution
 * @property {string} [title] - Optional session title
 * @property {Object} [metadata] - Additional metadata
 * @property {string} [sessionId] - Reuse an existing session
 */

/**
 * @typedef {Object} TaskHandle
 * @property {string} sessionId - OpenCode session ID
 * @property {string} taskId - StudioOS task ID
 */

/**
 * @typedef {Object} TaskExecutionStatus
 * @property {'pending'|'running'|'completed'|'failed'|'cancelled'} phase
 * @property {{ current: number, total: number, label: string }} [progress]
 */

/**
 * @typedef {Object} TaskExecutionEvent
 * @property {'thinking'|'tool_call'|'tool_result'|'text'|'completed'|'error'} type
 * @property {unknown} data
 * @property {number} timestamp
 */

/**
 * @typedef {Object} AgentDefinition
 * @property {string} name
 * @property {'primary'|'subagent'|'all'} mode
 * @property {string} [description]
 * @property {{ modelID: string, providerID: string }} [model]
 * @property {string} [color]
 * @property {string} [prompt]
 * @property {Array} [permission]
 * @property {number} [temperature]
 * @property {number} [topP]
 */

/**
 * @typedef {Object} AgentInfo
 * @property {string} name
 * @property {boolean} [native]
 * @property {string} [mode]
 * @property {{ modelID: string, providerID: string }} [model]
 */

/**
 * @typedef {Object} WorktreeConfig
 * @property {string} directory
 * @property {string} branchName
 * @property {string} [baseBranch]
 * @property {'new'|'existing'} mode
 * @property {string[]} [setupCommands]
 */

/**
 * @typedef {Object} WorktreeHandle
 * @property {string} path
 * @property {string} branchName
 * @property {string} worktreeId
 */

/**
 * @typedef {Object} CommitResult
 * @property {string} hash
 * @property {string} summary
 */

/**
 * @typedef {Object} WorktreeStatus
 * @property {string} branch
 * @property {boolean} isDirty
 * @property {number} ahead
 * @property {number} behind
 * @property {'ready'|'missing'|'invalid'} status
 */

/**
 * @typedef {Object} ExecutionCapabilities
 * @property {boolean} supportsWorktrees
 * @property {boolean} supportsConcurrentSessions
 * @property {number} maxConcurrentSessions
 * @property {string[]} supportedProviders
 * @property {string[]} supportedFeatures
 */

/**
 * @typedef {Object} ExecutionProvider
 * @property {(request: TaskExecutionRequest) => Promise<TaskHandle>} executeTask
 * @property {(taskId: string) => Promise<void>} cancelTask
 * @property {(taskId: string) => Promise<TaskExecutionStatus>} getTaskStatus
 * @property {(taskId: string) => AsyncIterable<TaskExecutionEvent>} streamTaskEvents
 * @property {(definition: AgentDefinition) => Promise<string>} createAgent
 * @property {(name: string, updates: Partial<AgentDefinition>) => Promise<void>} updateAgent
 * @property {(name: string) => Promise<void>} deleteAgent
 * @property {() => Promise<Array<AgentInfo>>} listAgents
 * @property {(config: WorktreeConfig) => Promise<WorktreeHandle>} createWorktree
 * @property {(worktreeId: string) => Promise<void>} removeWorktree
 * @property {(worktreeId: string, message: string) => Promise<CommitResult>} commitChanges
 * @property {(worktreeId: string) => Promise<WorktreeStatus>} getWorktreeStatus
 * @property {() => Promise<ExecutionCapabilities>} getCapabilities
 */
