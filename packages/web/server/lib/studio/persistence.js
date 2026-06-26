/**
 * Persistence — Atomic disk read/write for StudioOS state.
 *
 * Each project has its own directory under:
 *   ~/.config/openchamber/studio/<projectId>/
 *
 * Files:
 *   organization.json    — Organization structure + metadata
 *   tasks.json           — All tasks (root, department, worker)
 *   agents.json          — Agent instances (ephemeral state)
 *   identities.json      — All agent identities in the project
 *
 * All writes are atomic (write to .tmp, then rename).
 */

import fs from 'fs';
import path from 'path';

/**
 * Create the persistence layer.
 * @param {Object} deps
 * @param {string} deps.configDir - Base config directory (e.g. ~/.config/openchamber)
 */
export function createPersistence({ configDir }) {
  const BASE = path.join(configDir, 'studio');

  function projectDir(projectId) {
    const dir = path.join(BASE, projectId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  async function atomicWrite(filePath, data) {
    const tmpPath = filePath + '.tmp';
    await fs.promises.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    await fs.promises.rename(tmpPath, filePath);
  }

  async function atomicRead(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const raw = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  }

  // ─── Organization ───

  async function saveOrganization(projectId, organization) {
    const dir = projectDir(projectId);
    await atomicWrite(path.join(dir, 'organization.json'), organization);
  }

  async function loadOrganization(projectId) {
    const dir = projectDir(projectId);
    return atomicRead(path.join(dir, 'organization.json'));
  }

  async function deleteOrganization(projectId) {
    const dir = projectDir(projectId);
    if (fs.existsSync(dir)) {
      await fs.promises.rm(dir, { recursive: true, force: true });
    }
  }

  // ─── Tasks ───

  async function saveTasks(projectId, tasks) {
    const dir = projectDir(projectId);
    await atomicWrite(path.join(dir, 'tasks.json'), tasks);
  }

  async function loadTasks(projectId) {
    const dir = projectDir(projectId);
    return atomicRead(path.join(dir, 'tasks.json')) || [];
  }

  async function appendTask(projectId, task) {
    const tasks = await loadTasks(projectId);
    tasks.push(task);
    await saveTasks(projectId, tasks);
    return task;
  }

  async function updateTask(projectId, taskId, updates) {
    const tasks = await loadTasks(projectId);
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx === -1) return;
    tasks[idx] = { ...tasks[idx], ...updates, id: taskId };
    await saveTasks(projectId, tasks);
    return tasks[idx];
  }

  // ─── Agent Instances ───

  async function saveAgents(projectId, agents) {
    const dir = projectDir(projectId);
    await atomicWrite(path.join(dir, 'agents.json'), agents);
  }

  async function loadAgents(projectId) {
    const dir = projectDir(projectId);
    return atomicRead(path.join(dir, 'agents.json')) || [];
  }

  // ─── Identities ───

  async function saveIdentities(projectId, identities) {
    const dir = projectDir(projectId);
    await atomicWrite(path.join(dir, 'identities.json'), identities);
  }

  async function loadIdentities(projectId) {
    const dir = projectDir(projectId);
    return atomicRead(path.join(dir, 'identities.json')) || [];
  }

  async function saveIdentity(projectId, identity) {
    const identities = await loadIdentities(projectId);
    const idx = identities.findIndex(i => i.instanceId === identity.instanceId);
    if (idx >= 0) {
      identities[idx] = identity;
    } else {
      identities.push(identity);
    }
    await saveIdentities(projectId, identities);
    return identity;
  }

  async function loadIdentity(projectId, instanceId) {
    const identities = await loadIdentities(projectId);
    return identities.find(i => i.instanceId === instanceId) || null;
  }

  // ─── Full state save/load ───

  async function saveFullState(projectId, state) {
    const dir = projectDir(projectId);
    await saveOrganization(projectId, state.organization);
    await saveTasks(projectId, state.tasks);
    await saveAgents(projectId, state.agents);
    await saveIdentities(projectId, state.identities);
  }

  async function loadFullState(projectId) {
    const org = await loadOrganization(projectId);
    if (!org) return null;
    const tasks = await loadTasks(projectId);
    const agents = await loadAgents(projectId);
    const identities = await loadIdentities(projectId);
    return { organization: org, tasks, agents, identities, version: 1 };
  }

  return {
    saveOrganization,
    loadOrganization,
    deleteOrganization,
    saveTasks,
    loadTasks,
    appendTask,
    updateTask,
    saveAgents,
    loadAgents,
    saveIdentities,
    loadIdentities,
    saveIdentity,
    loadIdentity,
    saveFullState,
    loadFullState,
  };
}
