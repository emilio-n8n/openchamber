/**
 * Delegation — CEO prompt building and response parsing.
 *
 * Builds structured prompts for governance agents (CEOs) and
 * parses their JSON responses into tasks.
 */

import { validateTaskTransition } from '../runtime/state-machine.js';
import { formatRecentDecisions } from '../identity/history.js';

/**
 * Build the prompt for the Global CEO.
 * @param {Object} params
 * @param {string} params.objective - User's objective
 * @param {import('../types.js').Organization} params.organization
 * @param {import('../types.js').AgentIdentity} params.identity
 * @returns {string}
 */
export function buildGlobalCeoPrompt({ objective, organization, identity }) {
  const departments = organization.structure.departments;
  const recentDecisions = formatRecentDecisions(identity, 5);

  return `You are the ${identity.name}, the Global CEO of a software development organization.

YOUR STYLE: ${identity.managementStyle}
YOUR PERSONALITY: ${identity.personality}
YOUR SPECIALIZATION: ${identity.specialization}

YOUR TRACK RECORD:
- Decisions made: ${identity.performance.tasksCompleted}
- Success rate: ${(identity.performance.successRate * 100).toFixed(0)}%
- Experience level: ${identity.performance.experienceLevel}

YOUR SKILLS:
${identity.skills.map(s => `  - ${s.name} (${s.level})`).join('\n')}

YOUR RECENT DECISIONS:
${recentDecisions}

YOUR DEPARTMENTS:
${departments.map(d => `  - ${d.name} (${d.type}): ${d.objectives.join(', ') || 'no current objectives'}`).join('\n')}

USER OBJECTIVE:
${objective}

TASK INSTRUCTIONS:
1. Analyze this objective carefully.
2. Decide which departments need to be involved.
3. For each department, write a clear, actionable objective.
4. Set priorities (1 = highest) and dependencies between departments.

OUTPUT FORMAT (STRICT JSON — no prose before or after):
{
  "analysis": "Brief analysis of what needs to be done",
  "departments": [
    {
      "name": "tech",
      "objective": "Clear specific objective for the tech department",
      "priority": 1,
      "dependencies": []
    }
  ]
}

Return ONLY valid JSON. No markdown, no explanations.`;
}

/**
 * Build the prompt for a Department CEO.
 * @param {Object} params
 * @param {string} params.department
 * @param {string} params.objective
 * @param {import('../types.js').AgentIdentity} params.identity
 * @param {import('../types.js').Organization} params.organization
 * @returns {string}
 */
export function buildDeptCeoPrompt({ department, objective, identity, organization }) {
  const recentDecisions = formatRecentDecisions(identity, 5);

  return `You are the ${identity.name}, the ${department} department head.

YOUR STYLE: ${identity.managementStyle}
YOUR PERSONALITY: ${identity.personality}

YOUR TRACK RECORD:
- Decisions made: ${identity.performance.tasksCompleted}
- Success rate: ${(identity.performance.successRate * 100).toFixed(0)}%
- Experience level: ${identity.performance.experienceLevel}

YOUR SKILLS:
${identity.skills.map(s => `  - ${s.name} (${s.level}): ${(s.confidence * 100).toFixed(0)}%`).join('\n')}

YOUR RECENT DECISIONS:
${recentDecisions}

PROJECT DIRECTORY: ${organization.workspaceDirectory}

DEPARTMENT OBJECTIVE:
${objective}

TASK INSTRUCTIONS:
1. Analyze this objective and break it down into concrete, actionable worker tasks.
2. Each task should be small enough for one agent to complete.
3. Specify which tasks need git worktree isolation (modify code) vs not.
4. Order tasks by dependency (which must be done first).
5. Be specific about what files to create/modify and what commands to run.

OUTPUT FORMAT (STRICT JSON — no prose before or after):
{
  "analysis": "How you plan to approach this",
  "tasks": [
    {
      "title": "Initialize project with create-next-app",
      "description": "Detailed instructions including commands to run",
      "worktree": false,
      "priority": 1,
      "dependencies": [],
      "skills": ["node", "next.js"]
    }
  ]
}

Return ONLY valid JSON. No markdown, no explanations.`;
}

/**
 * Build the prompt for a Worker agent.
 * @param {Object} params
 * @param {import('../types.js').Task} params.task
 * @param {string} [params.worktreePath]
 * @param {import('../types.js').Organization} params.organization
 * @returns {string}
 */
export function buildWorkerPrompt({ task, worktreePath, organization }) {
  const cwd = worktreePath || organization.workspaceDirectory;

  return `You are a Worker AI agent. Execute the following task precisely.

YOUR TASK:
${task.description || task.title}

WORKING DIRECTORY: ${cwd}

RULES:
1. Work in the directory specified above.
2. Use your tools (bash, read, write, edit, glob, grep) to complete the task.
3. If you encounter an error, try to fix it once before reporting failure.
4. Report your final result clearly.
5. Do not ask questions — make reasonable assumptions and proceed.

Return a brief summary of what you accomplished.`;
}

/**
 * Parse the Global CEO's JSON response.
 * @param {string} output - Raw LLM output
 * @returns {{ analysis: string, departments: Array<{name: string, objective: string, priority: number, dependencies: string[]}> }}
 */
export function parseGlobalCeoResponse(output) {
  return parseJsonResponse(output);
}

/**
 * Parse a Department CEO's JSON response.
 * @param {string} output
 * @returns {{ analysis: string, tasks: Array<{title: string, description: string, worktree: boolean, priority: number, dependencies: string[], skills: string[]}> }}
 */
export function parseDeptCeoResponse(output) {
  return parseJsonResponse(output);
}

/**
 * Robust JSON parsing with fallbacks.
 * @param {string} text
 * @returns {Object}
 */
function parseJsonResponse(text) {
  // Direct parse
  try {
    return JSON.parse(text);
  } catch {
    // Try extracting from markdown code block
    const mdMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (mdMatch) {
      try {
        return JSON.parse(mdMatch[1].trim());
      } catch {
        // Continue to fallback
      }
    }

    // Try finding JSON object with regex
    const objMatch = text.match(/\{[\s\S]*"analysis"[\s\S]*"departments"[\s\S]*\}/);
    if (objMatch) {
      try {
        return JSON.parse(objMatch[0]);
      } catch {
        // Continue to fallback
      }
    }

    // Try finding JSON array
    const arrMatch = text.match(/\[[\s\S]*\{(?:[^{}]|(?:\{[^{}]*\}))*\}[\s\S]*\]/);
    if (arrMatch) {
      try {
        return JSON.parse(arrMatch[0]);
      } catch {
        // Fall through
      }
    }

    throw new Error(`Failed to parse JSON response: ${text.slice(0, 300)}...`);
  }
}
