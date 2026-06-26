/**
 * Organization Manager — CRUD for organizations + auto-generation.
 */

import fs from 'fs';
import path from 'path';
import { generateId } from './types.js';

export function createOrganizationManager({ persistence, identitySystem, executionProvider, eventBus }) {

  /**
   * Create a new StudioOS project with auto-generated organization.
   * @param {string} projectId
   * @param {string} name
   * @param {string} workspaceDirectory
   * @returns {Promise<import('./types.js').Organization>}
   */
  async function createProject(projectId, name, workspaceDirectory) {
    const analysis = await analyzeProject(workspaceDirectory);
    const departments = determineDepartments(analysis);

    const org = {
      id: projectId,
      name: name || `Project ${projectId}`,
      projectId,
      workspaceDirectory,
      status: 'creating',
      structure: {
        departments: [],
        governanceAgents: [],
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };

    // Create each department + its CEO identity
    for (const dept of departments) {
      const deptId = generateId('dept');
      const agentName = `studio-${dept.type}-ceo`;

      // Create agent identity
      const identity = identitySystem.createIdentity({
        role: 'dept-ceo',
        department: dept.type,
        projectAnalysis: analysis,
      });
      await identitySystem.save(projectId, identity);

      // Create the agent definition in OpenCode
      try {
        await executionProvider.createAgent({
          name: identity.agentName,
          mode: 'all',
          description: `${identity.name} — ${identity.personality}`,
          prompt: await getAgentPromptTemplate('dept-ceo', dept.type),
          permission: [
            { pattern: 'read', action: 'allow' },
            { pattern: 'task', action: 'allow' },
          ],
        });
      } catch (err) {
        console.error(`[studio] Failed to create agent ${identity.agentName}:`, err.message);
      }

      org.structure.departments.push({
        id: deptId,
        name: dept.name,
        type: dept.type,
        headAgentName: identity.agentName,
        objectives: [],
        agents: [],
        status: 'idle',
        createdAt: Date.now(),
      });

      org.structure.governanceAgents.push({
        role: 'dept-ceo',
        department: dept.type,
        agentName: identity.agentName,
        identityId: identity.instanceId,
        instanceId: identity.instanceId,
      });
    }

    // Create Global CEO identity
    const globalCeoIdentity = identitySystem.createIdentity({
      role: 'global-ceo',
      department: 'general',
      projectAnalysis: analysis,
    });
    await identitySystem.save(projectId, globalCeoIdentity);

    try {
      await executionProvider.createAgent({
        name: globalCeoIdentity.agentName,
        mode: 'all',
        description: `Global CEO — ${globalCeoIdentity.personality}`,
        prompt: await getAgentPromptTemplate('global-ceo'),
        permission: [
          { pattern: 'read', action: 'allow' },
          { pattern: 'task', action: 'allow' },
        ],
      });
    } catch (err) {
      console.error(`[studio] Failed to create Global CEO agent:`, err.message);
    }

    org.structure.governanceAgents.push({
      role: 'global-ceo',
      department: 'general',
      agentName: globalCeoIdentity.agentName,
      identityId: globalCeoIdentity.instanceId,
      instanceId: globalCeoIdentity.instanceId,
    });

    // Create worker identity
    const workerIdentity = identitySystem.createIdentity({
      role: 'worker',
      department: 'tech',
      projectAnalysis: analysis,
    });
    await identitySystem.save(projectId, workerIdentity);

    try {
      await executionProvider.createAgent({
        name: workerIdentity.agentName,
        mode: 'subagent',
        description: 'General purpose worker agent',
        prompt: await getAgentPromptTemplate('worker'),
        permission: [
          { pattern: 'read', action: 'allow' },
          { pattern: 'write', action: 'allow' },
          { pattern: 'edit', action: 'allow' },
          { pattern: 'bash', action: 'allow' },
          { pattern: 'glob', action: 'allow' },
          { pattern: 'grep', action: 'allow' },
        ],
      });
    } catch (err) {
      console.error(`[studio] Failed to create worker agent:`, err.message);
    }

    org.status = 'active';
    org.updatedAt = Date.now();
    await persistence.saveOrganization(projectId, org);

    eventBus.publish('organization.created', { organization: org });

    return org;
  }

  /**
   * Get the current organization.
   */
  async function getOrganization(projectId) {
    return persistence.loadOrganization(projectId);
  }

  /**
   * Update the organization structure.
   */
  async function updateOrganization(projectId, updates) {
    const org = await persistence.loadOrganization(projectId);
    if (!org) throw new Error('Organization not found');

    if (updates.structure) {
      org.structure = { ...org.structure, ...updates.structure };
    }
    if (updates.name) org.name = updates.name;
    if (updates.workspaceDirectory) org.workspaceDirectory = updates.workspaceDirectory;

    org.updatedAt = Date.now();
    org.version++;
    await persistence.saveOrganization(projectId, org);

    eventBus.publish('organization.updated', { organization: org });
    return org;
  }

  /**
   * Delete the organization.
   */
  async function deleteOrganization(projectId) {
    await persistence.deleteOrganization(projectId);
    eventBus.publish('organization.deleted', { projectId });
  }

  return {
    createProject,
    getOrganization,
    updateOrganization,
    deleteOrganization,
  };
}

/**
 * Analyze a project directory to detect its tech stack.
 */
async function analyzeProject(directory) {
  try {
    const analysis = { stack: 'generic', framework: null, language: null, hasPackageJson: false };

    // Check for package.json
    const pkgPath = path.join(directory, 'package.json');
    if (fs.existsSync(pkgPath)) {
      analysis.hasPackageJson = true;
      const pkg = JSON.parse(await fs.promises.readFile(pkgPath, 'utf-8'));
      const all = { ...pkg.dependencies, ...pkg.devDependencies };
      if (all.next) { analysis.stack = 'next.js'; analysis.framework = 'next'; analysis.language = 'typescript'; }
      else if (all.react) { analysis.stack = 'react'; analysis.framework = 'react'; analysis.language = 'typescript'; }
      else if (all.vue) { analysis.stack = 'vue'; analysis.framework = 'vue'; analysis.language = 'javascript'; }
      else if (all.express || all.fastify) { analysis.stack = 'node-backend'; analysis.framework = 'express'; analysis.language = 'typescript'; }
    }

    // Check for Python projects
    if (fs.existsSync(path.join(directory, 'requirements.txt')) ||
        fs.existsSync(path.join(directory, 'pyproject.toml'))) {
      analysis.stack = 'python-backend';
      analysis.language = 'python';
    }

    // Check for Go
    if (fs.existsSync(path.join(directory, 'go.mod'))) {
      analysis.stack = 'golang';
      analysis.language = 'go';
    }

    return analysis;
  } catch {
    return { stack: 'generic', framework: null, language: null, hasPackageJson: false };
  }
}

/**
 * Determine which departments to create based on project analysis.
 */
function determineDepartments(analysis) {
  const depts = [];

  switch (analysis.stack) {
    case 'next.js':
    case 'react':
    case 'vue':
      depts.push({ type: 'tech', name: 'Tech' });
      depts.push({ type: 'design', name: 'Design' });
      break;
    case 'node-backend':
    case 'python-backend':
    case 'golang':
      depts.push({ type: 'tech', name: 'Tech' });
      break;
    default:
      depts.push({ type: 'tech', name: 'Tech' });
      depts.push({ type: 'design', name: 'Design' });
      break;
  }

  return depts;
}

/**
 * Get the prompt template for a governance agent.
 */
async function getAgentPromptTemplate(role, department) {
  const templates = {
    'global-ceo': `You are the Global CEO of a software development organization powered by StudioOS.

Your role is to receive high-level objectives from the user and decompose them into department-level objectives. You DO NOT execute tasks yourself.

Your departments: Tech (architecture, backend, frontend), Design (UI/UX), QA (testing, validation), Product (requirements, roadmap).

Instructions:
1. Analyze the objective
2. Identify which departments are needed
3. For each department, write a clear, actionable objective
4. Set priority (1=highest) and dependencies

Always return your response as a structured JSON object with "analysis" and "departments" fields.`,

    'dept-ceo': `You are the ${department} department head. Your role is to receive department objectives and break them down into concrete worker tasks.

Instructions:
1. Analyze the objective
2. Break it into small, actionable tasks
3. Each task should be completable by one worker
4. Specify worktree=true for tasks that modify code
5. List required skills for each task

Always return your response as a structured JSON object with "analysis" and "tasks" fields.`,

    'worker': `You are a Worker AI agent. Execute the assigned task precisely using your available tools (read, write, edit, bash, glob, grep).

Rules:
- Work in the specified directory
- If you encounter an error, try to fix it once before reporting failure
- Do not ask questions — make reasonable assumptions and proceed
- Report your final result clearly`,
  };

  return templates[role] || templates['worker'];
}
