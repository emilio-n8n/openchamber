# Data Model — StudioOS

Ce document définit tous les types de données du système StudioOS. Chaque type est conçu pour être :

- **Persistable** (JSON → disque atomique)
- **Sérialisable** (JSON → SSE events)
- **Validable** (Zod schemas)
- **Évolutif** (ajout de champs sans breaking change)

## 1. Organization

```typescript
// ─── ORGANISATION ───
interface Organization {
  id: string
  name: string
  projectId: string                         // OpenChamber project ID
  workspaceDirectory: string                 // dossier de travail local
  status: OrganizationStatus
  structure: OrganizationStructure
  createdAt: number
  updatedAt: number
  version: number
}

type OrganizationStatus =
  | 'creating'        // en cours de génération
  | 'active'          // opérationnelle
  | 'paused'          // suspendue par l'utilisateur
  | 'archived'        // archivée

interface OrganizationStructure {
  departments: Department[]
  governanceAgents: GovernanceAgentRef[]
  rootTaskId?: string                        // tâche racine en cours
}

interface GovernanceAgentRef {
  role: AgentRole
  department: DepartmentType
  agentName: string                         // nom de l'agent OpenCode
  identityId: string                        // AgentIdentity.instanceId
  instanceId: string
}
```

## 2. Department

```typescript
interface Department {
  id: string
  name: string
  type: DepartmentType
  parentId?: string                         // fractal V2+
  headAgentName: string                     // l'agent CEO de ce département
  objectives: string[]                      // objectifs courants
  agents: AgentInstanceRef[]                // workers assignés (V2+)
  status: DepartmentStatus
  createdAt: number
}

type DepartmentStatus =
  | 'active'
  | 'idle'               // pas de tâche en cours
  | 'busy'               // tâches en cours d'exécution
  | 'blocked'            // dépend non résolue
  | 'paused'

interface AgentInstanceRef {
  id: string
  name: string
  role: 'worker' | 'lead' | 'manager'
  identityId: string
  status: AgentInstanceState
}
```

## 3. Agent Instance

```typescript
interface AgentInstance {
  id: string
  name: string
  role: AgentRole
  departmentId: string
  identityId: string                        // référence à AgentIdentity
  state: AgentInstanceState
  currentTaskId?: string
  sessionId?: string                        // session OpenCode active
  worktreePath?: string                     // git worktree si isolation
  createdAt: number
  lastActivityAt?: number
  iteration: number                         // nombre d'incarnations
}

type AgentInstanceState =
  | 'idle'               // pas de processus, état sauvegardé
  | 'spawning'           // session OpenCode en création
  | 'executing'          // LLM en train de répondre
  | 'waiting'            // en attente (dépendances, validation)
  | 'completed'          // décision rendue
  | 'error'              // erreur
```

## 4. Task

```typescript
interface Task {
  id: string
  projectId: string
  title: string
  description: string
  type: TaskType
  parentId?: string                         // pour le DAG hiérarchique
  childIds: string[]                        // sous-tâches décomposées
  departmentId?: string                     // département assigné
  assignedAgentId?: string                  // agent instance qui exécute
  sessionId?: string                        // session OpenCode associée
  worktreePath?: string
  status: TaskStatus
  priority: TaskPriority
  dependencies: string[]                    // task IDs qui doivent précéder
  metadata: TaskMetadata
  // Chronologie
  createdAt: number
  startedAt?: number
  completedAt?: number
  deadlineAt?: number
  // Résultats
  result?: TaskResult
  error?: string
  // Budget
  tokensUsed?: number
  cost?: number
}

type TaskType =
  | 'root'               // tâche utilisateur racine
  | 'department'         // objectif département
  | 'worker'             // tâche d'exécution

type TaskStatus =
  | 'pending'
  | 'decomposing'        // CEO en train de décomposer
  | 'assigned'           // assignée à un agent
  | 'in_progress'        // en cours d'exécution
  | 'completed'          // terminée avec succès
  | 'failed'             // échouée
  | 'blocked'            // bloquée par une dépendance
  | 'cancelled'

type TaskPriority =
  | 'critical'
  | 'high'
  | 'normal'
  | 'low'

interface TaskMetadata {
  source: 'user' | 'system' | 'delegation'
  parentChain?: string[]                    // [rootId, deptId, workerId]
  attempts?: number                         // nombre de tentatives
  maxAttempts?: number                      // default: 3
  tags?: string[]                           // pour catégorisation
}

interface TaskResult {
  summary: string
  details?: string
  artifacts?: Artifact[]                    // fichiers créés/modifiés
  decisions?: string[]                      // décisions prises pendant l'exécution
}

interface Artifact {
  path: string
  type: 'created' | 'modified' | 'deleted'
  summary: string
}
```

## 5. AgentIdentity

```typescript
interface AgentIdentity {
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
  version: number
  status: 'active' | 'paused' | 'retired' | 'promoted'
}

interface Skill {
  name: string
  level: SkillLevel
  lastUsed: number
  confidence: number       // 0-1
}

type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master'

interface DecisionRecord {
  taskId: string
  timestamp: number
  summary: string
  outcome: 'success' | 'failure' | 'partial'
  confidence: number
  tokensUsed: number
  cost: number
  details?: string
}

interface PerformanceMetrics {
  tasksCompleted: number
  tasksFailed: number
  successRate: number
  avgConfidence: number
  avgTokens: number
  avgCost: number
  totalCost: number
  promotionScore: number
  experienceLevel: ExperienceLevel
  decisionsLast30d: number
}

type ExperienceLevel = 'junior' | 'mid' | 'senior' | 'lead' | 'executive'

type AgentRole =
  | 'global-ceo'
  | 'dept-ceo'
  | 'director'
  | 'lead'
  | 'manager'
  | 'worker'
  | 'recruiter'
  | 'reviewer'

type DepartmentType =
  | 'tech'
  | 'design'
  | 'qa'
  | 'product'
  | 'operations'
  | 'production'
  | 'general'
```

## 6. ExecutionProvider Contract

```typescript
interface ExecutionProvider {
  // ─── Task Execution ───
  executeTask(request: TaskExecutionRequest): Promise<TaskHandle>
  cancelTask(taskId: string): Promise<void>
  getTaskStatus(taskId: string): Promise<TaskExecutionStatus>

  // ─── Streaming ───
  streamTaskEvents(taskId: string): AsyncIterable<TaskExecutionEvent>

  // ─── Agent Management ───
  createAgent(definition: AgentDefinition): Promise<string>
  updateAgent(name: string, updates: Partial<AgentDefinition>): Promise<void>
  deleteAgent(name: string): Promise<void>
  listAgents(): Promise<AgentInfo[]>

  // ─── Workspace ───
  createWorktree(config: WorktreeConfig): Promise<WorktreeHandle>
  removeWorktree(worktreeId: string): Promise<void>
  commitChanges(worktreeId: string, message: string): Promise<CommitResult>
  getWorktreeStatus(worktreeId: string): Promise<WorktreeStatus>

  // ─── Capabilities ───
  getCapabilities(): ExecutionCapabilities
}

interface TaskExecutionRequest {
  agent: string
  prompt: string
  workspaceDirectory: string
  title?: string
  metadata?: Record<string, unknown>
  sessionId?: string       // réutiliser une session existante
}

interface TaskHandle {
  sessionId: string
  taskId: string
}

interface TaskExecutionStatus {
  phase: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress?: {
    current: number
    total: number
    label: string
  }
}

interface TaskExecutionEvent {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'text' | 'completed' | 'error'
  data: unknown
  timestamp: number
}

interface AgentDefinition {
  name: string
  mode: 'primary' | 'subagent' | 'all'
  description?: string
  model?: { modelID: string; providerID: string }
  color?: string
  prompt?: string
  permission?: PermissionRuleset
  temperature?: number
  topP?: number
}

interface AgentInfo {
  name: string
  native?: boolean
  mode?: string
  model?: { modelID: string; providerID: string }
}

interface WorktreeConfig {
  directory: string
  branchName: string
  baseBranch?: string
  mode: 'new' | 'existing'
  setupCommands?: string[]
}

interface WorktreeHandle {
  path: string
  branchName: string
  worktreeId: string
}

interface CommitResult {
  hash: string
  summary: string
}

interface WorktreeStatus {
  branch: string
  isDirty: boolean
  ahead: number
  behind: number
  status: 'ready' | 'missing' | 'invalid'
}

interface ExecutionCapabilities {
  supportsWorktrees: boolean
  supportsConcurrentSessions: boolean
  maxConcurrentSessions: number
  supportedProviders: string[]
  supportedFeatures: string[]
}
```

## 7. Studio Project (persistence)

```typescript
// Fichier : ~/.config/openchamber/studio/<projectId>/organization.json
interface StudioProjectState {
  organization: Organization
  tasks: Task[]
  agents: AgentInstance[]
  identities: AgentIdentity[]               // toutes les identités du projet
  createdAt: number
  updatedAt: number
  version: number
}
```

## 8. API Contracts (Routes)

```typescript
// POST /api/studio/projects
interface CreateStudioProjectRequest {
  projectId: string
  workspaceDirectory: string
  name?: string
}

// GET /api/studio/projects/:id
interface StudioProjectResponse {
  id: string
  organization: Organization
  status: OrganizationStatus
  taskCount: number
  activeTaskCount: number
}

// POST /api/studio/projects/:id/tasks
interface SubmitTaskRequest {
  prompt: string
  priority?: 'critical' | 'high' | 'normal' | 'low'
  deadline?: number
}

interface SubmitTaskResponse {
  taskId: string
  status: 'pending'
  estimatedDelegationTime: number
}

// GET /api/studio/projects/:id/tasks
interface ListTasksResponse {
  tasks: Task[]
  tree: TaskTreeNode[]                      // hiérarchie parent → enfant
}

interface TaskTreeNode {
  task: Task
  children: TaskTreeNode[]
}

// GET /api/studio/projects/:id/live
// SSE stream: events studio.*
interface LiveEvent {
  type: string                              // 'studio.task.started', etc.
  data: unknown
  timestamp: number
}
```

## 9. Zod Schemas pour Validation

```typescript
import { z } from 'zod'

const TaskStatusSchema = z.enum([
  'pending', 'decomposing', 'assigned', 'in_progress',
  'completed', 'failed', 'blocked', 'cancelled',
])

const DepartmentTypeSchema = z.enum([
  'tech', 'design', 'qa', 'product', 'operations', 'production', 'general',
])

const AgentRoleSchema = z.enum([
  'global-ceo', 'dept-ceo', 'director', 'lead', 'manager',
  'worker', 'recruiter', 'reviewer',
])

const SkillLevelSchema = z.enum([
  'beginner', 'intermediate', 'advanced', 'expert', 'master',
])

const TaskSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string().min(1).max(500),
  description: z.string().max(10000).default(''),
  type: z.enum(['root', 'department', 'worker']),
  parentId: z.string().optional(),
  childIds: z.array(z.string()).default([]),
  departmentId: z.string().optional(),
  assignedAgentId: z.string().optional(),
  sessionId: z.string().optional(),
  worktreePath: z.string().optional(),
  status: TaskStatusSchema,
  priority: z.enum(['critical', 'high', 'normal', 'low']).default('normal'),
  dependencies: z.array(z.string()).default([]),
  metadata: z.object({
    source: z.enum(['user', 'system', 'delegation']),
    parentChain: z.array(z.string()).optional(),
    attempts: z.number().int().positive().optional(),
    maxAttempts: z.number().int().positive().default(3),
    tags: z.array(z.string()).optional(),
  }).default({ source: 'user' }),
  createdAt: z.number(),
  startedAt: z.number().optional(),
  completedAt: z.number().optional(),
  deadlineAt: z.number().optional(),
  tokensUsed: z.number().optional(),
  cost: z.number().optional(),
})

const AgentIdentitySchema = z.object({
  role: AgentRoleSchema,
  department: DepartmentTypeSchema,
  agentName: z.string(),
  instanceId: z.string(),
  name: z.string(),
  personality: z.string(),
  managementStyle: z.string(),
  specialization: z.string(),
  skills: z.array(z.object({
    name: z.string(),
    level: SkillLevelSchema,
    lastUsed: z.number(),
    confidence: z.number().min(0).max(1),
  })),
  decisions: z.array(z.object({
    taskId: z.string(),
    timestamp: z.number(),
    summary: z.string(),
    outcome: z.enum(['success', 'failure', 'partial']),
    confidence: z.number().min(0).max(1),
    tokensUsed: z.number(),
    cost: z.number(),
    details: z.string().optional(),
  })),
  performance: z.object({
    tasksCompleted: z.number().int().nonnegative(),
    tasksFailed: z.number().int().nonnegative(),
    successRate: z.number().min(0).max(1),
    avgConfidence: z.number().min(0).max(1),
    avgTokens: z.number().nonnegative(),
    avgCost: z.number().nonnegative(),
    totalCost: z.number().nonnegative(),
    promotionScore: z.number().int().min(0).max(100),
    experienceLevel: z.enum(['junior', 'mid', 'senior', 'lead', 'executive']),
    decisionsLast30d: z.number().int().nonnegative(),
  }),
  iteration: z.number().int().nonnegative(),
  createdAt: z.number(),
  lastDecisionAt: z.number(),
  version: z.number().int().positive(),
  status: z.enum(['active', 'paused', 'retired', 'promoted']),
})
```

## 10. Relations entre les Entités

```
Organization
  │
  ├── departments: Department[]
  │     │
  │     ├── headAgentName → GovernanceAgentRef
  │     └── agents: AgentInstanceRef[]
  │           │
  │           └── identityId → AgentIdentity
  │
  ├── tasks: Task[]
  │     │
  │     ├── parentId → Task (DAG parent)
  │     ├── childIds → Task[] (sous-tâches)
  │     ├── departmentId → Department
  │     ├── assignedAgentId → AgentInstance
  │     └── sessionId → OpenCode Session
  │
  └── governanceAgents: GovernanceAgentRef[]
        │
        └── identityId → AgentIdentity

AgentIdentity
  │
  ├── decisions[] → DecisionRecord
  ├── skills[] → Skill
  └── performance → PerformanceMetrics
```

### Contraintes

1. Une `Task` de type `worker` a toujours un `assignedAgentId` et une `sessionId`
2. Une `Task` de type `department` a toujours un `departmentId` mais pas de `sessionId`
3. Une `Task` de type `root` n'a ni `sessionId` ni `assignedAgentId`
4. Chaque `AgentIdentity` a un `instanceId` unique par projet
5. Les `DecisionRecord` sont append-only (ne jamais modifier, toujours ajouter)
6. Le `promotionScore` est calculé, jamais assigné manuellement
