/**
 * Routes — REST API for StudioOS (/api/studio/*)
 *
 * Registered by feature-routes-runtime.js.
 * Creates the StudioOS runtime lazily using available route dependencies.
 */

import { createStudioRuntime } from './index.js';
import { createProjectSSEStream } from './events.js';

/** @type {import('./index.js').StudioRuntime | null} */
let _studioRuntime = null;

/**
 * Get or create the StudioOS runtime.
 */
async function getStudio(routeDeps) {
  if (_studioRuntime) return _studioRuntime;

  const {
    openchamberDataDir,
    buildOpenCodeUrl,
    getOpenCodeAuthHeaders,
    writeSseEvent,
  } = routeDeps;

  let opencodeClient = null;
  try {
    if (buildOpenCodeUrl) {
      const { createOpencodeClient } = await import('@opencode-ai/sdk/v2');
      const headers = getOpenCodeAuthHeaders ? getOpenCodeAuthHeaders() : {};
      opencodeClient = createOpencodeClient({
        baseUrl: buildOpenCodeUrl(),
        headers,
      });
    }
  } catch (err) {
    console.error('[studio] Failed to create OpenCode client:', err.message);
  }

  let eventHub = null;
  if (writeSseEvent) {
    eventHub = { emit: writeSseEvent };
  }

  const configDir = openchamberDataDir || (process.env.HOME ? `${process.env.HOME}/.config/openchamber` : './config');

  _studioRuntime = createStudioRuntime({
    opencodeClient,
    eventHub,
    configDir,
  });

  return _studioRuntime;
}

/**
 * Register StudioOS routes on the Express app.
 * @param {import('express').Express} app
 * @param {Object} routeDeps - Route dependencies from feature-routes-runtime
 */
export async function registerStudioRoutes(app, routeDeps) {
  /** @type {import('./index.js').StudioRuntime} */
  let studio;

  try {
    studio = await getStudio(routeDeps);
  } catch (err) {
    console.error('[studio] Failed to initialize StudioOS runtime:', err.message);
    return;
  }

  // ─── Projects ───

  /**
   * POST /api/studio/projects
   * Create a new StudioOS project with auto-generated organization.
   */
  app.post('/api/studio/projects', async (req, res) => {
    try {
      const { projectId, name, workspaceDirectory } = req.body;
      if (!projectId) return res.status(400).json({ error: 'projectId is required' });
      if (!workspaceDirectory) return res.status(400).json({ error: 'workspaceDirectory is required' });

      const org = await studio.createProject(projectId, name, workspaceDirectory);
      res.status(201).json(org);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Organization ───

  /**
   * GET /api/studio/projects/:id/organization
   * Get the organization structure.
   */
  app.get('/api/studio/projects/:id/organization', async (req, res) => {
    try {
      const org = await studio.getOrganization(req.params.id);
      if (!org) return res.status(404).json({ error: 'Organization not found' });
      res.json(org);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * PUT /api/studio/projects/:id/organization
   * Update the organization structure.
   */
  app.put('/api/studio/projects/:id/organization', async (req, res) => {
    try {
      const org = await studio.updateOrganization(req.params.id, req.body);
      res.json(org);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * DELETE /api/studio/projects/:id
   * Delete a StudioOS project.
   */
  app.delete('/api/studio/projects/:id', async (req, res) => {
    try {
      await studio.deleteOrganization(req.params.id);
      res.status(204).end();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Tasks ───

  /**
   * POST /api/studio/projects/:id/tasks
   * Submit a new task to the organization.
   */
  app.post('/api/studio/projects/:id/tasks', async (req, res) => {
    try {
      const { prompt, priority } = req.body;
      if (!prompt) return res.status(400).json({ error: 'prompt is required' });

      const task = await studio.submitTask(req.params.id, prompt, { priority });
      res.status(201).json({
        taskId: task.id,
        status: task.status,
        createdAt: task.createdAt,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/studio/projects/:id/tasks
   * List all tasks for a project.
   */
  app.get('/api/studio/projects/:id/tasks', async (req, res) => {
    try {
      const tasks = await studio.listTasks(req.params.id);
      res.json(tasks || []);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/studio/projects/:id/tasks/:taskId
   * Get a single task.
   */
  app.get('/api/studio/projects/:id/tasks/:taskId', async (req, res) => {
    try {
      const task = await studio.getTask(req.params.id, req.params.taskId);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      res.json(task);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/studio/projects/:id/tasks/:taskId/cancel
   * Cancel a running task.
   */
  app.post('/api/studio/projects/:id/tasks/:taskId/cancel', async (req, res) => {
    try {
      await studio.cancelTask(req.params.taskId);
      res.json({ status: 'cancelled' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Identities ───

  /**
   * GET /api/studio/projects/:id/identities
   * List all agent identities for a project.
   */
  app.get('/api/studio/projects/:id/identities', async (req, res) => {
    try {
      const identities = await studio.listAgentIdentities(req.params.id);
      res.json(identities);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/studio/projects/:id/identities/:instanceId
   * Get a specific agent identity.
   */
  app.get('/api/studio/projects/:id/identities/:instanceId', async (req, res) => {
    try {
      const identity = await studio.getAgentIdentity(req.params.id, req.params.instanceId);
      if (!identity) return res.status(404).json({ error: 'Identity not found' });
      res.json(identity);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Live Stream (SSE) ───

  /**
   * GET /api/studio/projects/:id/live
   * SSE stream of real-time organization activity.
   */
  app.get('/api/studio/projects/:id/live', (req, res) => {
    createProjectSSEStream(studio.eventBus, res, req.params.id);
  });

  // ─── Status ───

  /**
   * GET /api/studio/projects/:id/status
   * Get StudioOS runtime status.
   */
  app.get('/api/studio/projects/:id/status', async (req, res) => {
    try {
      const org = await studio.getOrganization(req.params.id);
      const tasks = await studio.listTasks(req.params.id);
      const identities = await studio.listAgentIdentities(req.params.id);
      const queueStatus = studio.taskQueue?.getStatus?.() || {};

      res.json({
        organization: org?.status || 'inactive',
        taskCount: (tasks || []).length,
        activeTasks: (tasks || []).filter(t => t.status === 'in_progress' || t.status === 'decomposing').length,
        agentCount: (identities || []).length,
        queue: queueStatus,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
