// StudioOS — Client-side types

export type StudioMode = 'openchamber' | 'studio'

export type OrganizationStatus = 'creating' | 'active' | 'paused' | 'archived'

export type DepartmentType = 'tech' | 'design' | 'qa' | 'product' | 'operations' | 'production' | 'general'

export type TaskType = 'root' | 'department' | 'worker'

export type TaskStatus = 'pending' | 'decomposing' | 'assigned' | 'in_progress' | 'completed' | 'failed' | 'blocked' | 'cancelled'

export type TaskPriority = 'critical' | 'high' | 'normal' | 'low'

export type AgentRole = 'global-ceo' | 'dept-ceo' | 'director' | 'lead' | 'manager' | 'worker' | 'recruiter' | 'reviewer'

export type AgentState = 'idle' | 'spawning' | 'executing' | 'waiting' | 'completed' | 'error'

export interface Organization {
  id: string
  name: string
  projectId: string
  workspaceDirectory: string
  status: OrganizationStatus
  structure: OrganizationStructure
  createdAt: number
  updatedAt: number
  version: number
}

export interface OrganizationStructure {
  departments: Department[]
  governanceAgents: GovernanceAgentRef[]
  rootTaskId?: string
}

export interface Department {
  id: string
  name: string
  type: DepartmentType
  parentId?: string
  headAgentName: string
  objectives: string[]
  agents: AgentInstanceRef[]
  status: 'active' | 'idle' | 'busy' | 'blocked' | 'paused'
  createdAt: number
}

export interface AgentInstanceRef {
  id: string
  name: string
  role: 'worker' | 'lead' | 'manager'
  identityId: string
  status: AgentState
}

export interface GovernanceAgentRef {
  role: AgentRole
  department: DepartmentType
  agentName: string
  identityId: string
  instanceId: string
}

export interface Task {
  id: string
  projectId: string
  title: string
  description: string
  type: TaskType
  parentId?: string
  childIds: string[]
  departmentId?: string
  assignedAgentId?: string
  sessionId?: string
  worktreePath?: string
  status: TaskStatus
  priority: TaskPriority
  dependencies: string[]
  metadata: {
    source: 'user' | 'system' | 'delegation'
    parentChain?: string[]
    attempts?: number
    maxAttempts?: number
    tags?: string[]
  }
  createdAt: number
  startedAt?: number
  completedAt?: number
  deadlineAt?: number
  tokensUsed?: number
  cost?: number
}

export interface AgentIdentity {
  role: AgentRole
  department: DepartmentType
  agentName: string
  instanceId: string
  name: string
  personality: string
  managementStyle: string
  specialization: string
  skills: Skill[]
  decisions: DecisionRecord[]
  performance: PerformanceMetrics
  iteration: number
  createdAt: number
  lastDecisionAt: number
  status: 'active' | 'paused' | 'retired' | 'promoted'
}

export interface Skill {
  name: string
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master'
  lastUsed: number
  confidence: number
}

export interface DecisionRecord {
  taskId: string
  timestamp: number
  summary: string
  outcome: 'success' | 'failure' | 'partial'
  confidence: number
  tokensUsed: number
  cost: number
}

export interface PerformanceMetrics {
  tasksCompleted: number
  tasksFailed: number
  successRate: number
  avgConfidence: number
  avgTokens: number
  avgCost: number
  totalCost: number
  promotionScore: number
  experienceLevel: 'junior' | 'mid' | 'senior' | 'lead' | 'executive'
  decisionsLast30d: number
}

export interface LiveActivity {
  type: string
  taskId?: string
  agentName?: string
  data: unknown
  timestamp: number
}

export interface StudioProjectSummary {
  id: string
  name: string
  directory: string
  status: OrganizationStatus
  isActive: boolean
  taskCount: number
  activeTaskCount: number
  agentCount: number
}
