/**
 * Evolution — Performance metrics, promotions, skill progression.
 *
 * After each decision, the agent's skills and performance evolve:
 *   - Skills level up based on successful usage
 *   - Skills level down on repeated failure
 *   - Promotion score is calculated from composite metrics
 *   - Experience level is derived from total decisions
 */

/**
 * Update skills after a task.
 * @param {import('../types.js').AgentIdentity} identity
 * @param {import('../types.js').Task} task
 * @param {'success'|'failure'} outcome
 */
export function updateSkills(identity, task, outcome) {
  const relevantSkills = extractRelevantSkills(task);
  const change = outcome === 'success' ? 0.05 : -0.1;

  for (const skillName of relevantSkills) {
    let skill = identity.skills.find(s => s.name === skillName);
    if (!skill) {
      skill = {
        name: skillName,
        level: 'beginner',
        lastUsed: Date.now(),
        confidence: 0.5,
      };
      identity.skills.push(skill);
    }

    skill.confidence = Math.max(0, Math.min(1, skill.confidence + change));
    skill.lastUsed = Date.now();
    skill.level = calculateLevel(skill.confidence, outcome === 'success');
  }
}

const SKILL_THRESHOLDS = [
  { min: 0.85, level: 'master' },
  { min: 0.70, level: 'expert' },
  { min: 0.55, level: 'advanced' },
  { min: 0.40, level: 'intermediate' },
  { min: 0, level: 'beginner' },
];

function calculateLevel(confidence, success) {
  if (!success) {
    // Never master or expert if last use was a failure
    if (confidence < 0.55) return 'intermediate';
    return 'advanced';
  }
  for (const t of SKILL_THRESHOLDS) {
    if (confidence >= t.min) return t.level;
  }
  return 'beginner';
}

/**
 * Extract skill names from a task's title and description.
 * @param {import('../types.js').Task} task
 * @returns {string[]}
 */
function extractRelevantSkills(task) {
  const text = `${task.title} ${task.description}`.toLowerCase();
  const SKILL_PATTERNS = [
    { pattern: /typescript|tsx?|\.ts\b/, name: 'typescript' },
    { pattern: /javascript|js\b|node/i, name: 'javascript' },
    { pattern: /\breact\b|jsx|tsx/, name: 'react' },
    { pattern: /next\.?js/i, name: 'next.js' },
    { pattern: /\bvue\b/i, name: 'vue' },
    { pattern: /\bpython\b/i, name: 'python' },
    { pattern: /\bsql\b|postgres|mysql|database/i, name: 'sql' },
    { pattern: /\bapi\b|rest|graphql|endpoint/i, name: 'api-design' },
    { pattern: /\bgit\b|branch|commit|pr|merge/i, name: 'git' },
    { pattern: /docker|container|compose/i, name: 'docker' },
    { pattern: /\btest\b|jest|vitest|cypress|testing/i, name: 'testing' },
    { pattern: /\bcss\b|tailwind|style/i, name: 'css' },
    { pattern: /\bhtml\b/i, name: 'html' },
    { pattern: /\bdeploy|ci|cd|pipeline/i, name: 'devops' },
  ];

  const found = SKILL_PATTERNS
    .filter(({ pattern }) => pattern.test(text))
    .map(({ name }) => name);

  return [...new Set(found)];
}

/**
 * Calculate promotion score (0-100).
 * Composite of: success rate, volume, confidence, efficiency.
 */
export function calculatePromotionScore(identity) {
  const { tasksCompleted, tasksFailed, avgConfidence, totalCost } = identity.performance;
  const total = tasksCompleted + tasksFailed;
  if (total === 0) return 0;

  const SUCCESS_WEIGHT = 0.4;
  const VOLUME_WEIGHT = 0.25;
  const CONFIDENCE_WEIGHT = 0.2;
  const EFFICIENCY_WEIGHT = 0.15;

  const successScore = (tasksCompleted / total) * 100;
  const volumeScore = Math.min(100, (total / 50) * 100);
  const confidenceScore = avgConfidence * 100;
  const avgCostPerTask = totalCost / Math.max(1, total);
  const efficiencyScore = Math.max(0, 100 - (avgCostPerTask / 10));

  return Math.round(
    successScore * SUCCESS_WEIGHT +
    volumeScore * VOLUME_WEIGHT +
    confidenceScore * CONFIDENCE_WEIGHT +
    efficiencyScore * EFFICIENCY_WEIGHT
  );
}

const EXPERIENCE_THRESHOLDS = [
  { min: 1000, minScore: 80, level: 'executive' },
  { min: 500, level: 'lead' },
  { min: 100, level: 'senior' },
  { min: 20, level: 'mid' },
  { min: 0, level: 'junior' },
];

/**
 * Update experience level based on decision count and performance.
 */
export function updateExperienceLevel(identity) {
  const { tasksCompleted } = identity.performance;
  for (const t of EXPERIENCE_THRESHOLDS) {
    if (tasksCompleted >= t.min) {
      if (t.minScore !== undefined && identity.performance.promotionScore < t.minScore) {
        continue; // Not enough score for this level
      }
      identity.performance.experienceLevel = t.level;
      return;
    }
  }
}

/**
 * Run all evolution updates after a decision.
 */
export function evolveAfterDecision(identity, task, outcome) {
  updateSkills(identity, task, outcome);
  identity.performance.promotionScore = calculatePromotionScore(identity);
  updateExperienceLevel(identity);
  return identity;
}
