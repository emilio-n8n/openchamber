/**
 * OpenCodeExecutionProvider — Implementation of ExecutionProvider using @opencode-ai/sdk.
 *
 * This is the default (and initially only) execution provider for StudioOS.
 * It maps StudioOS operations to OpenCode SDK calls.
 */

/**
 * Create an OpenCode execution provider.
 * @param {Object} deps
 * @param {import('../../opencode/client.js')} [deps.opencodeClient] - OpenCode SDK wrapper
 * @param {import('../../git/service.js')} [deps.gitService] - Git service for worktrees
 * @param {import('../runtime/event-bus.js').EventBus} [deps.eventBus] - Internal event bus
 * @returns {import('./provider.js').ExecutionProvider}
 */
export function createOpenCodeExecutionProvider(deps = {}) {
  const { opencodeClient, gitService, eventBus } = deps;

  /**
   * Execute a task by creating an OpenCode session and sending a prompt.
   */
  async function executeTask(request) {
    if (!opencodeClient) {
      throw new Error('OpenCode client not available');
    }

    const session = await opencodeClient.createSession({
      directory: request.workspaceDirectory,
      title: request.title || `StudioOS: ${request.agent}`,
      metadata: {
        studioTask: true,
        agent: request.agent,
        ...(request.metadata || {}),
      },
    });

    const sessionId = session.id;

    await opencodeClient.sendMessage({
      sessionID: sessionId,
      directory: request.workspaceDirectory,
      agent: request.agent,
      messageID: generateMessageId(),
      parts: [{ type: 'text', text: request.prompt }],
    });

    return { sessionId, taskId: request.metadata?.taskId || sessionId };
  }

  /**
   * Cancel a running task by aborting its OpenCode session.
   */
  async function cancelTask(taskId) {
    if (!opencodeClient) return;
    try {
      await opencodeClient.abortSession({ sessionID: taskId });
    } catch {
      // Session may already be done
    }
  }

  /**
   * Get the current status of a task.
   */
  async function getTaskStatus(taskId) {
    if (!opencodeClient) return { phase: 'unknown' };
    try {
      const status = await opencodeClient.getSessionStatus(taskId);
      if (status?.type === 'busy') return { phase: 'running' };
      if (status?.type === 'idle') return { phase: 'completed' };
      return { phase: 'pending' };
    } catch {
      return { phase: 'failed' };
    }
  }

  /**
   * Stream task execution events from an OpenCode session.
   * Yields tool calls, text output, completion, and errors.
   */
  async function* streamTaskEvents(taskId) {
    if (!opencodeClient) return;

    // Subscribe to SSE events for this session
    const eventSource = opencodeClient.streamSessionEvents(taskId);

    try {
      for await (const event of eventSource) {
        if (event.type === 'session.status') {
          if (event.status === 'idle') {
            // Session is done — fetch the final messages
            const messages = await opencodeClient.getSessionMessages(taskId);
            const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
            yield {
              type: 'completed',
              data: lastAssistant?.text || '',
              timestamp: Date.now(),
            };
            return;
          }
        }

        if (event.type === 'message.part.updated') {
          const part = event.part;
          if (part?.type === 'tool') {
            yield {
              type: 'tool_call',
              data: { tool: part.tool, input: part.input, output: part.output },
              timestamp: Date.now(),
            };
          }
          if (part?.type === 'text') {
            yield {
              type: 'text',
              data: part.text,
              timestamp: Date.now(),
            };
          }
        }

        if (event.type === 'message.part.delta') {
          // Streaming text chunks
          yield {
            type: 'thinking',
            data: event.delta?.text || '',
            timestamp: Date.now(),
          };
        }
      }
    } catch (err) {
      yield {
        type: 'error',
        data: err.message || 'Unknown stream error',
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Create an agent definition in OpenCode.
   */
  async function createAgent(definition) {
    if (!opencodeClient) throw new Error('OpenCode client not available');
    await opencodeClient.createAgent(definition.name, definition);
    return definition.name;
  }

  async function updateAgent(name, updates) {
    if (!opencodeClient) return;
    await opencodeClient.updateAgent(name, updates);
  }

  async function deleteAgent(name) {
    if (!opencodeClient) return;
    await opencodeClient.deleteAgent(name);
  }

  async function listAgents() {
    if (!opencodeClient) return [];
    return opencodeClient.listAgents();
  }

  /**
   * Create a git worktree for workspace isolation.
   */
  async function createWorktree(config) {
    if (!gitService) throw new Error('Git service not available');
    const result = await gitService.createWorktree(config.directory, {
      mode: config.mode,
      branchName: config.branchName,
    });
    return {
      path: result.path,
      branchName: result.branch,
      worktreeId: `wt_${Date.now()}`,
    };
  }

  async function removeWorktree(worktreeId) {
    // Worktree cleanup delegated to git service
  }

  async function commitChanges(worktreeId, message) {
    return { hash: '', summary: message };
  }

  async function getWorktreeStatus(worktreeId) {
    return { branch: '', isDirty: false, ahead: 0, behind: 0, status: 'ready' };
  }

  async function getCapabilities() {
    return {
      supportsWorktrees: !!gitService,
      supportsConcurrentSessions: true,
      maxConcurrentSessions: 5,
      supportedProviders: [],
      supportedFeatures: ['agents', 'worktrees', 'streaming'],
    };
  }

  return {
    executeTask,
    cancelTask,
    getTaskStatus,
    streamTaskEvents,
    createAgent,
    updateAgent,
    deleteAgent,
    listAgents,
    createWorktree,
    removeWorktree,
    commitChanges,
    getWorktreeStatus,
    getCapabilities,
  };
}

function generateMessageId() {
  const now = Date.now().toString(16);
  const rand = Math.random().toString(16).slice(2, 8);
  return `msg_${now}_${rand}`;
}
