/**
 * Orchestrator — CEO → Department → Worker delegation flow.
 *
 * The core of StudioOS. Receives a user objective, delegates through the
 * organization hierarchy, and returns results.
 */

import fs from 'fs';
import path from 'path';
import { generateId } from './types.js';
import { buildGlobalCeoPrompt, buildDeptCeoPrompt, buildWorkerPrompt,
         parseGlobalCeoResponse, parseDeptCeoResponse } from './delegation.js';
import { recordDecision } from './identity/history.js';
import { evolveAfterDecision } from './identity/evolution.js';

/**
 * Create the orchestrator.
 * @param {Object} deps
 * @param {import('./runtime/event-bus.js').EventBus} deps.eventBus
 * @param {import('./runtime/state-machine.js')} deps.stateMachine
 * @param {import('./runtime/scheduler.js')} deps.scheduler
 * @param {import('./runtime/task-queue.js')} deps.taskQueue
 * @param {import('./runtime/supervisor.js')} deps.supervisor
 * @param {import('./execution/provider.js').ExecutionProvider} deps.executionProvider
 * @param {import('./identity/identity.js')} deps.identitySystem
 * @param {import('./persistence.js')} deps.persistence
 */
export function createOrchestrator({
  eventBus, stateMachine, scheduler, taskQueue,
  supervisor, executionProvider, identitySystem, persistence,
}) {

  /**
   * Submit a new task to the organization.
   * @param {string} projectId
   * @param {string} prompt - User's objective
   * @param {Object} [options]
   * @param {'critical'|'high'|'normal'|'low'} [options.priority]
   * @returns {Promise<import('../types.js').Task>}
   */
  async function submitTask(projectId, prompt, options = {}) {
    const org = await persistence.loadOrganization(projectId);
    if (!org) throw new Error('Organization not found. Create one first.');

    const rootTask = {
      id: generateId('task'),
      projectId,
      title: prompt.length > 100 ? prompt.slice(0, 100) + '...' : prompt,
      description: prompt,
      type: 'root',
      parentId: undefined,
      childIds: [],
      status: 'decomposing',
      priority: options.priority || 'normal',
      dependencies: [],
      metadata: { source: 'user' },
      createdAt: Date.now(),
    };

    await persistence.appendTask(projectId, rootTask);
    stateMachine.transitionTask(rootTask, 'decomposing');
    eventBus.publish('task.created', { task: rootTask });

    // Delegate to Global CEO
    try {
      const result = await delegateToGlobalCeo(projectId, rootTask, org, options);
      rootTask.status = 'completed';
      rootTask.childIds = result.taskIds;
      await persistence.updateTask(projectId, rootTask.id, rootTask);
      eventBus.publish('task.completed', { taskId: rootTask.id, result: result.summary });
    } catch (err) {
      rootTask.status = 'failed';
      rootTask.error = err.message;
      await persistence.updateTask(projectId, rootTask.id, rootTask);
      eventBus.publish('task.failed', { taskId: rootTask.id, error: err.message });
      throw err;
    }

    return rootTask;
  }

  /**
   * Delegate to the Global CEO for decomposition.
   */
  async function delegateToGlobalCeo(projectId, rootTask, org) {
    const identity = await identitySystem.getOrCreate(projectId, {
      role: 'global-ceo',
      department: 'general',
      projectAnalysis: { stack: await detectStack(org.workspaceDirectory) },
    });

    const prompt = buildGlobalCeoPrompt({
      objective: rootTask.title,
      organization: org,
      identity,
    });

    const handle = await executionProvider.executeTask({
      agent: identity.agentName,
      prompt,
      workspaceDirectory: org.workspaceDirectory,
      metadata: { taskId: rootTask.id, studioTask: true },
    });

    rootTask.sessionId = handle.sessionId;

    // Collect the full response
    let fullResponse = '';
    for await (const event of executionProvider.streamTaskEvents(handle.sessionId)) {
      if (event.type === 'text' || event.type === 'thinking') {
        fullResponse += event.data || '';
        eventBus.publish('task.activity', {
          taskId: rootTask.id, type: event.type, data: event.data, timestamp: event.timestamp,
        });
      }
      if (event.type === 'completed') {
        fullResponse = event.data || fullResponse;
      }
      if (event.type === 'error') {
        throw new Error(`Global CEO error: ${event.data}`);
      }
    }

    // Parse the CEO's plan
    const plan = parseGlobalCeoResponse(fullResponse);
    const departmentTasks = [];

    // Decompose into department tasks
    for (const deptGoal of (plan.departments || [])) {
      const dept = org.structure.departments.find(d => d.type === deptGoal.name);
      if (!dept) continue;

      const deptTask = await delegateToDepartment(projectId, rootTask.id, dept, deptGoal, org);
      departmentTasks.push(deptTask);
    }

    // Record the decision
    const decision = {
      taskId: rootTask.id,
      summary: plan.analysis || rootTask.title,
      outcome: 'success',
      confidence: 0.85,
    };
    recordDecision(identity, decision);
    evolveAfterDecision(identity, rootTask, 'success');
    await identitySystem.save(projectId, identity);

    return {
      summary: `Completed ${departmentTasks.length} department goals`,
      taskIds: departmentTasks.map(t => t.id),
    };
  }

  /**
   * Delegate to a Department CEO for worker task decomposition.
   */
  async function delegateToDepartment(projectId, parentTaskId, department, goal, org) {
    const deptTask = {
      id: generateId('task'),
      projectId,
      title: `[${department.name}] ${goal.objective.slice(0, 80)}`,
      description: goal.objective,
      type: 'department',
      parentId: parentTaskId,
      childIds: [],
      departmentId: department.id,
      status: 'decomposing',
      priority: goal.priority <= 2 ? 'high' : 'normal',
      dependencies: [],
      metadata: { source: 'delegation', parentChain: [parentTaskId] },
      createdAt: Date.now(),
    };

    await persistence.appendTask(projectId, deptTask);
    eventBus.publish('task.created', { task: deptTask });

    const identity = await identitySystem.getOrCreate(projectId, {
      role: 'dept-ceo',
      department: department.type,
      projectAnalysis: { stack: await detectStack(org.workspaceDirectory) },
    });

    const prompt = buildDeptCeoPrompt({
      department: department.name,
      objective: goal.objective,
      identity,
      organization: org,
    });

    const handle = await executionProvider.executeTask({
      agent: identity.agentName,
      prompt,
      workspaceDirectory: org.workspaceDirectory,
      metadata: { taskId: deptTask.id, studioTask: true },
    });

    deptTask.sessionId = handle.sessionId;

    let fullResponse = '';
    for await (const event of executionProvider.streamTaskEvents(handle.sessionId)) {
      if (event.type === 'text' || event.type === 'thinking') {
        fullResponse += event.data || '';
        eventBus.publish('task.activity', {
          taskId: deptTask.id, type: event.type, data: event.data, timestamp: event.timestamp,
        });
      }
      if (event.type === 'completed') {
        fullResponse = event.data || fullResponse;
      }
      if (event.type === 'error') {
        throw new Error(`${department.name} CEO error: ${event.data}`);
      }
    }

    // Parse department CEO's worker task list
    const plan = parseDeptCeoResponse(fullResponse);
    const workerTaskIds = [];

    // Create and queue worker tasks
    for (const wt of (plan.tasks || [])) {
      const workerTask = await createWorkerTask(projectId, deptTask.id, department.id, wt, org);
      workerTaskIds.push(workerTask.id);
    }

    // Record the decision
    const decision = {
      taskId: deptTask.id,
      summary: plan.analysis || goal.objective,
      outcome: 'success',
      confidence: 0.8,
    };
    recordDecision(identity, decision);
    evolveAfterDecision(identity, deptTask, 'success');
    await identitySystem.save(projectId, identity);

    deptTask.childIds = workerTaskIds;
    await persistence.updateTask(projectId, deptTask.id, deptTask);
    eventBus.publish('task.decomposed', { taskId: deptTask.id, children: workerTaskIds });

    return deptTask;
  }

  /**
   * Create and queue a worker task.
   */
  async function createWorkerTask(projectId, parentTaskId, departmentId, wtDef, org) {
    const workerTask = {
      id: generateId('task'),
      projectId,
      title: wtDef.title,
      description: wtDef.description || wtDef.title,
      type: 'worker',
      parentId: parentTaskId,
      childIds: [],
      departmentId,
      status: 'pending',
      priority: wtDef.priority <= 2 ? 'high' : 'normal',
      dependencies: wtDef.dependencies || [],
      metadata: { source: 'delegation', parentChain: [projectId, parentTaskId] },
      createdAt: Date.now(),
    };

    // Create worktree if needed
    if (wtDef.worktree) {
      try {
        const worktree = await executionProvider.createWorktree({
          directory: org.workspaceDirectory,
          branchName: `studio/${workerTask.id}`,
          mode: 'new',
        });
        workerTask.worktreePath = worktree.path;
      } catch (err) {
        workerTask.worktreePath = org.workspaceDirectory;
      }
    }

    // Find or create a worker identity
    const workerId = await identitySystem.getOrCreate(projectId, {
      role: 'worker',
      department: departmentId,
      projectAnalysis: { stack: await detectStack(org.workspaceDirectory) },
    });

    workerTask.assignedAgentId = workerId.agentName;

    await persistence.appendTask(projectId, workerTask);
    stateMachine.transitionTask(workerTask, 'pending');
    eventBus.publish('task.created', { task: workerTask });

    // Queue for execution
    taskQueue.enqueue(workerTask, workerTask.priority === 'high' ? 'high' : 'normal');

    return workerTask;
  }

  /**
   * Cancel a running task.
   */
  async function cancelTask(taskId) {
    taskQueue.cancel(taskId);
    await persistence.updateTask(taskId.split('_')[0], taskId, { status: 'cancelled' });
    eventBus.publish('task.cancelled', { taskId });
  }

  /**
   * List all tasks for a project.
   */
  async function listTasks(projectId) {
    return persistence.loadTasks(projectId);
  }

  /**
   * Get a single task.
   */
  async function getTask(projectId, taskId) {
    const tasks = await persistence.loadTasks(projectId);
    return tasks.find(t => t.id === taskId) || null;
  }

  async function detectStack(workspaceDirectory) {
    try {
      if (fs.existsSync(workspaceDirectory)) {
        const pkgPath = path.join(workspaceDirectory, 'package.json');
        if (fs.existsSync(pkgPath)) {
          const pkg = JSON.parse(await fs.promises.readFile(pkgPath, 'utf-8'));
          if (pkg.dependencies?.next) return 'next.js';
          if (pkg.dependencies?.react) return 'react';
          if (pkg.dependencies?.vue) return 'vue';
          return 'node-backend';
        }
        if (fs.existsSync(path.join(workspaceDirectory, 'requirements.txt'))) return 'python-backend';
        if (fs.existsSync(path.join(workspaceDirectory, 'go.mod'))) return 'golang';
      }
    } catch {}
    return 'generic';
  }

  return {
    submitTask,
    cancelTask,
    listTasks,
    getTask,
  };
}
