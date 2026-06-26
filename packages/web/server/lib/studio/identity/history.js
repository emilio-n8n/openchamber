/**
 * History — Append-only decision recording for agent identities.
 *
 * Every decision an agent makes is recorded in its identity.
 * Decisions are never modified, only appended.
 */

/**
 * Record a decision in an agent's identity.
 * @param {import('../types.js').AgentIdentity} identity
 * @param {Object} decision
 * @param {string} decision.taskId
 * @param {string} decision.summary
 * @param {'success'|'failure'|'partial'} decision.outcome
 * @param {number} decision.confidence - 0-1
 * @param {number} [decision.tokensUsed]
 * @param {number} [decision.cost]
 * @param {string} [decision.details]
 */
export function recordDecision(identity, decision) {
  identity.decisions.push({
    taskId: decision.taskId,
    timestamp: Date.now(),
    summary: decision.summary.slice(0, 200),
    outcome: decision.outcome,
    confidence: Math.max(0, Math.min(1, decision.confidence)),
    tokensUsed: decision.tokensUsed || 0,
    cost: decision.cost || 0,
    details: decision.details,
  });

  identity.lastDecisionAt = Date.now();
  identity.iteration++;

  // Update performance counters
  identity.performance.tasksCompleted++;
  if (decision.outcome !== 'success') {
    identity.performance.tasksFailed++;
  }

  // Success rate
  const total = identity.performance.tasksCompleted + identity.performance.tasksFailed;
  identity.performance.successRate = total > 0
    ? identity.performance.tasksCompleted / total
    : 1.0;

  // Moving averages
  identity.performance.avgConfidence = movingAverage(
    identity.performance.avgConfidence,
    decision.confidence,
    0.9
  );
  identity.performance.avgTokens = movingAverage(
    identity.performance.avgTokens,
    decision.tokensUsed || 0,
    0.9
  );
  identity.performance.avgCost = movingAverage(
    identity.performance.avgCost,
    decision.cost || 0,
    0.9
  );
  identity.performance.totalCost += decision.cost || 0;

  // Recent decisions (last 30 days)
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  identity.performance.decisionsLast30d = identity.decisions.filter(
    d => d.timestamp > thirtyDaysAgo
  ).length;

  return identity;
}

function movingAverage(current, newValue, alpha = 0.9) {
  if (current === 0) return newValue;
  return alpha * current + (1 - alpha) * newValue;
}

/**
 * Get decision history for an identity.
 * @param {import('../types.js').AgentIdentity} identity
 * @param {Object} [options]
 * @param {number} [options.limit]
 * @param {'success'|'failure'|'partial'} [options.outcome]
 * @returns {import('../types.js').DecisionRecord[]}
 */
export function getDecisionHistory(identity, options = {}) {
  let decisions = [...identity.decisions].reverse();

  if (options.outcome) {
    decisions = decisions.filter(d => d.outcome === options.outcome);
  }

  if (options.limit) {
    decisions = decisions.slice(0, options.limit);
  }

  return decisions;
}

/**
 * Get recent decision summaries for prompt context.
 * @param {import('../types.js').AgentIdentity} identity
 * @param {number} [count=5]
 * @returns {string}
 */
export function formatRecentDecisions(identity, count = 5) {
  const recent = getDecisionHistory(identity, { limit: count });
  if (recent.length === 0) return 'No previous decisions.';

  return recent.map(d =>
    `[${d.outcome}] ${d.summary} — confidence: ${(d.confidence * 100).toFixed(0)}%`
  ).join('\n');
}
