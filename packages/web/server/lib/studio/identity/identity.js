/**
 * Agent Identity — Persistent identity for StudioOS agents.
 *
 * Each agent role (Global CEO, Tech CEO, Worker, etc.) has a persistent identity
 * that survives across sessions. The identity carries:
 *   - Role & department assignment
 *   - Skills (evolve with usage)
 *   - Decision history (append-only)
 *   - Performance metrics
 *   - Personality & management style
 *
 * Instances are ephemeral — the identity persists.
 */

/**
 * @param {Object} deps
 * @param {import('../persistence.js').Persistence} deps.persistence
 */
export function createIdentitySystem({ persistence }) {

  function generateInstanceId(role, department) {
    const ts = Date.now().toString(36);
    return `${role}_${department}_${ts}`;
  }

  // ─── Personality / Style generators ───

  const PERSONALITY_MAP = {
    'global-ceo': [
      'Strategic, visionary, decisive',
      'Big-picture thinker, delegative, patient',
      'Results-driven, systematic, clear communicator',
    ],
    'dept-ceo': [
      'Analytical, pragmatic, detail-oriented',
      'Architecture-first, quality-obsessed, systematic',
      'Innovative, hands-on, solution-focused',
    ],
    'worker': [
      'Focused, methodical, reliable',
      'Efficient, autonomous, practical',
      'Detail-oriented, proactive, communicative',
    ],
  };

  const STYLE_MAP = {
    'global-ceo': 'Goal-oriented, high-trust, outcome-focused',
    'dept-ceo': 'Clear objectives, regular checkpoints, empowering',
    'worker': 'Self-directed, proactive, communicative',
  };

  function pickOne(options, seed) {
    const index = Math.abs(seed) % options.length;
    return options[index];
  }

  /**
   * Create a new agent identity.
   */
  function createIdentity({ role, department, projectAnalysis }) {
    const now = Date.now();
    const seed = (role + department + (projectAnalysis?.stack || '')).length;

    return {
      role,
      department,
      agentName: `studio-${department}-${role}`,
      instanceId: generateInstanceId(role, department),
      name: formatRoleName(role, department),
      personality: pickOne(PERSONALITY_MAP[role] || PERSONALITY_MAP['worker'], seed),
      managementStyle: STYLE_MAP[role] || STYLE_MAP['worker'],
      specialization: projectAnalysis?.stack || 'general',
      skills: generateInitialSkills(role, department, projectAnalysis),
      decisions: [],
      performance: {
        tasksCompleted: 0,
        tasksFailed: 0,
        successRate: 1.0,
        avgConfidence: 0,
        avgTokens: 0,
        avgCost: 0,
        totalCost: 0,
        promotionScore: 0,
        experienceLevel: 'junior',
        decisionsLast30d: 0,
      },
      iteration: 0,
      createdAt: now,
      lastDecisionAt: now,
      version: 1,
      status: 'active',
    };
  }

  function formatRoleName(role, department) {
    const map = {
      'global-ceo': 'Global CEO',
      'dept-ceo': `${capitalize(department)} CEO`,
      'worker': `${capitalize(department)} Worker`,
      'recruiter': 'Recruiter',
      'reviewer': 'Reviewer',
      'director': `${capitalize(department)} Director`,
      'lead': `${capitalize(department)} Lead`,
      'manager': `${capitalize(department)} Manager`,
    };
    return map[role] || `${capitalize(department)} ${role}`;
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function generateInitialSkills(role, department, projectAnalysis) {
    const skills = [];

    const STACK_SKILLS = {
      'next.js': ['typescript', 'react', 'next.js', 'node.js'],
      'react': ['typescript', 'react', 'node.js'],
      'vue': ['javascript', 'vue', 'node.js'],
      'react-native': ['typescript', 'react', 'react-native'],
      'node-backend': ['javascript', 'node.js', 'express'],
      'python-backend': ['python', 'fastapi', 'sql'],
      'generic': ['javascript', 'html', 'css'],
    };

    const relevant = STACK_SKILLS[projectAnalysis?.stack] || STACK_SKILLS['generic'];

    if (role === 'global-ceo') {
      skills.push(...relevant.slice(0, 2).map(s => ({
        name: s, level: 'intermediate', lastUsed: Date.now(), confidence: 0.6,
      })));
    } else if (role === 'worker') {
      skills.push(...relevant.map(s => ({
        name: s, level: 'intermediate', lastUsed: Date.now(), confidence: 0.7,
      })));
    }

    skills.push({
      name: 'code-review',
      level: 'intermediate',
      lastUsed: Date.now(),
      confidence: 0.65,
    });

    return skills;
  }

  // ─── CRUD ───

  async function save(projectId, identity) {
    identity.lastDecisionAt = Date.now();
    return persistence.saveIdentity(projectId, identity);
  }

  async function load(projectId, instanceId) {
    return persistence.loadIdentity(projectId, instanceId);
  }

  async function list(projectId) {
    return persistence.loadIdentities(projectId);
  }

  /**
   * Get identity, creating a default one if none exists.
   */
  async function getOrCreate(projectId, { role, department, projectAnalysis }) {
    const identities = await list(projectId);
    const existing = identities.find(
      i => i.role === role && i.department === department
    );
    if (existing) return existing;

    const identity = createIdentity({ role, department, projectAnalysis });
    await save(projectId, identity);
    return identity;
  }

  return {
    createIdentity,
    getOrCreate,
    save,
    load,
    list,
  };
}
