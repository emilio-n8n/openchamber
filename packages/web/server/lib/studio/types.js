import { z } from 'zod';

// ─── Enums ───

export const TaskStatus = z.enum([
  'pending', 'decomposing', 'assigned', 'in_progress',
  'completed', 'failed', 'blocked', 'cancelled',
]);

export const TaskType = z.enum(['root', 'department', 'worker']);

export const TaskPriority = z.enum(['critical', 'high', 'normal', 'low']);

export const DepartmentType = z.enum([
  'tech', 'design', 'qa', 'product', 'operations', 'production', 'general',
]);

export const AgentRole = z.enum([
  'global-ceo', 'dept-ceo', 'director', 'lead', 'manager',
  'worker', 'recruiter', 'reviewer',
]);

export const AgentInstanceState = z.enum([
  'idle', 'spawning', 'executing', 'waiting', 'completed', 'error',
]);

export const OrganizationStatus = z.enum(['creating', 'active', 'paused', 'archived']);

export const SkillLevel = z.enum(['beginner', 'intermediate', 'advanced', 'expert', 'master']);

export const Outcome = z.enum(['success', 'failure', 'partial']);

export const ExperienceLevel = z.enum(['junior', 'mid', 'senior', 'lead', 'executive']);

export const IdentityStatus = z.enum(['active', 'paused', 'retired', 'promoted']);

// ─── Objects ───

export const SkillSchema = z.object({
  name: z.string(),
  level: SkillLevel,
  lastUsed: z.number(),
  confidence: z.number().min(0).max(1),
});

export const DecisionRecordSchema = z.object({
  taskId: z.string(),
  timestamp: z.number(),
  summary: z.string().max(200),
  outcome: Outcome,
  confidence: z.number().min(0).max(1),
  tokensUsed: z.number().nonnegative(),
  cost: z.number().nonnegative(),
  details: z.string().optional(),
});

export const PerformanceMetricsSchema = z.object({
  tasksCompleted: z.number().int().nonnegative(),
  tasksFailed: z.number().int().nonnegative(),
  successRate: z.number().min(0).max(1),
  avgConfidence: z.number().min(0).max(1),
  avgTokens: z.number().nonnegative(),
  avgCost: z.number().nonnegative(),
  totalCost: z.number().nonnegative(),
  promotionScore: z.number().int().min(0).max(100),
  experienceLevel: ExperienceLevel,
  decisionsLast30d: z.number().int().nonnegative(),
});

export const AgentIdentitySchema = z.object({
  role: AgentRole,
  department: DepartmentType,
  agentName: z.string(),
  instanceId: z.string(),
  name: z.string(),
  personality: z.string(),
  managementStyle: z.string(),
  specialization: z.string(),
  skills: z.array(SkillSchema).default([]),
  decisions: z.array(DecisionRecordSchema).default([]),
  performance: PerformanceMetricsSchema,
  iteration: z.number().int().nonnegative(),
  createdAt: z.number(),
  lastDecisionAt: z.number(),
  version: z.number().int().positive(),
  status: IdentityStatus,
});

export const TaskMetadataSchema = z.object({
  source: z.enum(['user', 'system', 'delegation']),
  parentChain: z.array(z.string()).optional(),
  attempts: z.number().int().positive().optional(),
  maxAttempts: z.number().int().positive().default(3),
  tags: z.array(z.string()).optional(),
});

export const TaskSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string().min(1).max(500),
  description: z.string().max(10000).default(''),
  type: TaskType,
  parentId: z.string().optional(),
  childIds: z.array(z.string()).default([]),
  departmentId: z.string().optional(),
  assignedAgentId: z.string().optional(),
  sessionId: z.string().optional(),
  worktreePath: z.string().optional(),
  status: TaskStatus,
  priority: TaskPriority.default('normal'),
  dependencies: z.array(z.string()).default([]),
  metadata: TaskMetadataSchema.default({ source: 'user' }),
  createdAt: z.number(),
  startedAt: z.number().optional(),
  completedAt: z.number().optional(),
  deadlineAt: z.number().optional(),
  tokensUsed: z.number().optional(),
  cost: z.number().optional(),
});

export const GovernanceAgentRefSchema = z.object({
  role: AgentRole,
  department: DepartmentType,
  agentName: z.string(),
  identityId: z.string(),
  instanceId: z.string(),
});

export const AgentInstanceRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(['worker', 'lead', 'manager']),
  identityId: z.string(),
  status: AgentInstanceState,
});

export const DepartmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: DepartmentType,
  parentId: z.string().optional(),
  headAgentName: z.string(),
  objectives: z.array(z.string()).default([]),
  agents: z.array(AgentInstanceRefSchema).default([]),
  status: z.enum(['active', 'idle', 'busy', 'blocked', 'paused']),
  createdAt: z.number(),
});

export const OrganizationStructureSchema = z.object({
  departments: z.array(DepartmentSchema).default([]),
  governanceAgents: z.array(GovernanceAgentRefSchema).default([]),
  rootTaskId: z.string().optional(),
});

export const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  projectId: z.string(),
  workspaceDirectory: z.string(),
  status: OrganizationStatus,
  structure: OrganizationStructureSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
  version: z.number().int().positive().default(1),
});

export const AgentInstanceSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: AgentRole,
  departmentId: z.string(),
  identityId: z.string(),
  state: AgentInstanceState,
  currentTaskId: z.string().optional(),
  sessionId: z.string().optional(),
  worktreePath: z.string().optional(),
  createdAt: z.number(),
  lastActivityAt: z.number().optional(),
  iteration: z.number().int().nonnegative().default(0),
});

export const ArtifactSchema = z.object({
  path: z.string(),
  type: z.enum(['created', 'modified', 'deleted']),
  summary: z.string(),
});

export const TaskResultSchema = z.object({
  summary: z.string(),
  details: z.string().optional(),
  artifacts: z.array(ArtifactSchema).optional(),
  decisions: z.array(z.string()).optional(),
});

export const StudioProjectStateSchema = z.object({
  organization: OrganizationSchema,
  tasks: z.array(TaskSchema).default([]),
  agents: z.array(AgentInstanceSchema).default([]),
  identities: z.array(AgentIdentitySchema).default([]),
  createdAt: z.number(),
  updatedAt: z.number(),
  version: z.number().int().positive(),
});

// ─── Defaults / Factories ───

let _idCounter = 0;
export function generateId(prefix = 'stu') {
  _idCounter++;
  return `${prefix}_${Date.now()}_${_idCounter}`;
}

export function createDefaultPerformance() {
  return {
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
  };
}
