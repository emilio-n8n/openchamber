# Implementation Guide — StudioOS V1

Guide étape par étape pour implémenter la V1 de StudioOS. Chaque étape est indépendante et testable.

## Ordre d'Implémentation Recommandé

```
1.  Data Model + Types        (fondation)
2.  ExecutionProvider          (contrat d'abstraction)
3.  Persistence                (sauvegarde d'état)
4.  Organization Runtime       (event-bus → state-machine → scheduler → task-queue → supervisor)
5.  Identity System            (identité persistante)
6.  Orchestrator               (flow CEO → Dept → Worker)
7.  Organization Manager       (CRUD org + génération)
8.  Routes + SSE events        (API)
9.  UI Stores                  (Zustand)
10. Modifications du cœur      (navigation, routes)
11. UI Components              (vues)
12. Templates d'agents         (prompts CEO)
13. Tests + Validation         (end-to-end)
```

## Étape 1 : Data Model + Types

### Fichiers à créer

```
packages/web/server/lib/studio/types.ts
packages/ui/src/lib/studio/types.ts    (copie partielle côté client)
```

### Contenu

Définir tous les types TypeScript du DATA-MODEL.md, avec les schémas Zod pour la validation.

### Code minimal

```typescript
// packages/web/server/lib/studio/types.ts
import { z } from 'zod'

export const TaskStatusSchema = z.enum([
  'pending', 'decomposing', 'assigned', 'in_progress',
  'completed', 'failed', 'blocked', 'cancelled',
])

export const DepartmentTypeSchema = z.enum([
  'tech', 'design', 'qa', 'product', 'operations', 'production', 'general',
])

// ... tous les autres schemas Zod du DATA-MODEL.md

export interface Task {
  id: string
  projectId: string
  title: string
  description: string
  type: 'root' | 'department' | 'worker'
  parentId?: string
  childIds: string[]
  departmentId?: string
  assignedAgentId?: string
  sessionId?: string
  worktreePath?: string
  status: z.infer<typeof TaskStatusSchema>
  priority: 'critical' | 'high' | 'normal' | 'low'
  dependencies: string[]
  metadata: { source: 'user' | 'system' | 'delegation'; parentChain?: string[]; attempts?: number }
  createdAt: number
  startedAt?: number
  completedAt?: number
  deadlineAt?: number
  tokensUsed?: number
  cost?: number
}

// ... Organization, Department, AgentIdentity, etc.
```

### Validation

- `bun run type-check:web` passe
- Les schémas Zod valident correctement des exemples

---

## Étape 2 : ExecutionProvider

### Fichiers à créer

```
packages/web/server/lib/studio/execution/provider.js
packages/web/server/lib/studio/execution/opencode-provider.js
```

### Contenu

L'interface `ExecutionProvider` + l'implémentation OpenCode. Voir ARCHITECTURE.md pour le contrat.

### Test

```javascript
// Test avec un mock
const mockProvider = {
  executeTask: async (req) => ({ sessionId: 'test-123', taskId: 'task-1' }),
  streamTaskEvents: async function* (id) {
    yield { type: 'completed', data: '{"departments": []}', timestamp: Date.now() }
  },
  // ...
}
```

---

## Étape 3 : Persistence

### Fichiers à créer

```
packages/web/server/lib/studio/persistence.js
```

### Code minimal

```javascript
// persistence.js
import fs from 'fs'
import path from 'path'

function createPersistence(projectConfig) {
  const BASE_DIR = path.join(projectConfig.configDir, 'studio')

  function ensureDir(projectId) {
    const dir = path.join(BASE_DIR, projectId)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    return dir
  }

  async function save(filename, data) {
    const filePath = path.join(BASE_DIR, filename)
    const tmpPath = filePath + '.tmp'
    await fs.promises.writeFile(tmpPath, JSON.stringify(data, null, 2))
    await fs.promises.rename(tmpPath, filePath)  // atomic write
  }

  async function load(filename) {
    const filePath = path.join(BASE_DIR, filename)
    if (!fs.existsSync(filePath)) return null
    const raw = await fs.promises.readFile(filePath, 'utf-8')
    return JSON.parse(raw)
  }

  async function saveOrganization(projectId, org) {
    const dir = ensureDir(projectId)
    await save(path.join(dir, 'organization.json'), org)
  }

  async function loadOrganization(projectId) {
    return load(path.join(projectId, 'organization.json'))
  }

  // ... saveTasks, loadTasks, saveIdentity, loadIdentity, etc.

  return { saveOrganization, loadOrganization, saveIdentity, loadIdentity }
}
```

---

## Étape 4 : Organization Runtime

### Fichiers à créer

```
packages/web/server/lib/studio/runtime/event-bus.js
packages/web/server/lib/studio/runtime/state-machine.js
packages/web/server/lib/studio/runtime/scheduler.js
packages/web/server/lib/studio/runtime/task-queue.js
packages/web/server/lib/studio/runtime/supervisor.js
packages/web/server/lib/studio/runtime/runtime.js        (composition)
```

### Ordre d'implémentation

1. `event-bus.js` — indépendant, testable en isolation
2. `state-machine.js` — dépend de event-bus
3. `scheduler.js` — dépend de event-bus
4. `task-queue.js` — dépend de event-bus + execution provider
5. `supervisor.js` — dépend de event-bus
6. `runtime.js` — compose le tout

### Test unitaire (event-bus)

```javascript
const bus = createEventBus()
const results = []
bus.subscribe('test.event', (e, p) => results.push(p))
bus.publish('test.event', { msg: 'hello' })
console.assert(results.length === 1)
console.assert(results[0].msg === 'hello')
```

---

## Étape 5 : Identity System

### Fichiers à créer

```
packages/web/server/lib/studio/identity/identity.js
packages/web/server/lib/studio/identity/history.js
packages/web/server/lib/studio/identity/evolution.js
```

### Ordre

1. `identity.js` — createAgentIdentity, saveIdentity, loadIdentity, listIdentities
2. `history.js` — recordDecision, getDecisionHistory
3. `evolution.js` — updateSkills, updatePromotionScore, updateExperienceLevel

---

## Étape 6 : Orchestrator

### Fichiers à créer

```
packages/web/server/lib/studio/orchestrator.js
packages/web/server/lib/studio/delegation.js
```

### Flow principal

```javascript
// orchestrator.js
async function submitTask(projectId, prompt) {
  // 1. Récupère l'org et les identités
  const org = await persistence.loadOrganization(projectId)
  const globalCeoIdentity = await identity.loadIdentity(org.governanceAgents.find(a => a.role === 'global-ceo').identityId)

  // 2. Crée la tâche racine
  const rootTask = tasks.createTask({ type: 'root', title: prompt, projectId })
  eventBus.publish('task.created', rootTask)

  // 3. Instancie le Global CEO
  const ceoHandle = await instantiateAgent(rootTask, globalCeoIdentity, org)
  eventBus.publish('task.decomposing', { taskId: rootTask.id })

  // 4. Attend la réponse du CEO
  for await (const event of executionProvider.streamTaskEvents(ceoHandle.sessionId)) {
    if (event.type === 'completed') {
      const plan = parseCeoResponse(event.data)
      eventBus.publish('task.decomposed', { taskId: rootTask.id, departments: plan.departments })

      // 5. Délègue chaque département
      for (const dept of plan.departments) {
        await delegateToDepartment(rootTask.id, dept, org)
      }

      eventBus.publish('task.completed', { taskId: rootTask.id })
      return rootTask
    }
    if (event.type === 'error') {
      eventBus.publish('task.failed', { taskId: rootTask.id, error: event.data })
      throw new Error(event.data)
    }
  }
}
```

### Parsing de la réponse CEO

```javascript
// delegation.js
function parseCeoResponse(output) {
  // Essaye de parser le JSON directement
  try {
    return JSON.parse(output)
  } catch {
    // Fallback : extraire le JSON du texte markdown
    const jsonMatch = output.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) return JSON.parse(jsonMatch[1])

    // Fallback : parsing tolérant
    const deptMatch = output.match(/"departments"\s*:\s*\[([\s\S]*?)\]/)
    if (deptMatch) return extractDepartments(deptMatch[1])
  }
  throw new Error('Failed to parse CEO response: ' + output.slice(0, 200))
}
```

---

## Étape 7 : Organization Manager

### Fichiers à créer

```
packages/web/server/lib/studio/organization.js
packages/web/server/lib/studio/org-generator.js
packages/web/server/lib/studio/agent-templates.js
```

---

## Étape 8 : Routes + SSE Events

### Fichiers à créer

```
packages/web/server/lib/studio/routes.js
packages/web/server/lib/studio/events.js
```

### Routes V1

```javascript
// routes.js
function registerStudioRoutes(app, deps) {
  const studio = deps.studioRuntime

  // Créer un projet StudioOS
  app.post('/api/studio/projects', async (req, res) => {
    const { projectId, workspaceDirectory } = req.body
    const org = await studio.generateOrganization(projectId, workspaceDirectory)
    res.json(org)
  })

  // Récupérer l'organisation
  app.get('/api/studio/projects/:id/organization', async (req, res) => {
    const org = await studio.getOrganization(req.params.id)
    res.json(org)
  })

  // Modifier l'organisation
  app.put('/api/studio/projects/:id/organization', async (req, res) => {
    const org = await studio.updateOrganization(req.params.id, req.body)
    res.json(org)
  })

  // Soumettre une tâche
  app.post('/api/studio/projects/:id/tasks', async (req, res) => {
    const { prompt, priority, deadline } = req.body
    const task = await studio.submitTask(req.params.id, prompt, { priority, deadline })
    res.status(201).json({ taskId: task.id, status: task.status })
  })

  // Lister les tâches
  app.get('/api/studio/projects/:id/tasks', async (req, res) => {
    const tasks = await studio.listTasks(req.params.id)
    res.json(tasks)
  })

  // Stream SSE temps réel
  app.get('/api/studio/projects/:id/live', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    const unsubscribe = studio.events.subscribeProject(req.params.id, (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    })
    req.on('close', unsubscribe)
  })
}
```

---

## Étape 9 : UI Stores

### Fichiers à créer

```
packages/ui/src/stores/useStudioStore.ts
packages/ui/src/stores/useOrganizationStore.ts
packages/ui/src/stores/useStudioTaskStore.ts
packages/ui/src/sync/studio-sync.ts
```

### useStudioStore

```typescript
// useStudioStore.ts
interface StudioState {
  mode: 'openchamber' | 'studio'
  activeProjectId: string | null
  projects: StudioProjectSummary[]
  isOnboarding: boolean
}

// Actions
interface StudioActions {
  switchMode: (mode: 'openchamber' | 'studio') => void
  createProject: (projectId: string, directory: string) => Promise<void>
  setActiveProject: (projectId: string) => void
  completeOnboarding: () => void
}
```

### studio-sync.ts

```typescript
// studio-sync.ts — Handler pour les événements studio.*
function createStudioSyncHandler() {
  function handleStudioEvent(event, data) {
    const store = useOrganizationStore.getState()
    const taskStore = useStudioTaskStore.getState()

    switch (event) {
      case 'studio.organization.created':
      case 'studio.organization.updated':
        store.setOrganization(data.organization)
        break
      case 'studio.task.created':
      case 'studio.task.status_changed':
        taskStore.upsertTask(data)
        break
      case 'studio.task.activity':
        taskStore.addActivity(data.taskId, data)
        break
      case 'studio.agent.state_changed':
        store.updateAgentState(data.agentId, data.state)
        break
      case 'studio.identity.updated':
        store.updateAgentPerformance(data.agentId, data.performance)
        break
    }
  }

  return { handleStudioEvent }
}
```

---

## Étape 10 : Modifications du Cœur

### Fichiers à modifier

```diff
// packages/ui/src/stores/useUIStore.ts:12
+ type MainTab = ... | 'studio'

// packages/ui/src/lib/router/types.ts:32
+ const VALID_TABS = [... ,'studio']

// packages/ui/src/components/layout/MainLayout.tsx
+ import StudioView from '../views/StudioView'
+ case 'studio':
+   return <StudioView />

// packages/web/server/lib/opencode/feature-routes-runtime.js
+ registerStudioRoutes(app, deps)
```

---

## Étape 11 : Templates d'Agents

### Fichiers à créer

```
packages/web/server/lib/studio/agents/templates/global-ceo.md
packages/web/server/lib/studio/agents/templates/tech-ceo.md
packages/web/server/lib/studio/agents/templates/design-ceo.md
packages/web/server/lib/studio/agents/templates/worker.md
```

Voir V1-SCOPE.md pour les prompts complets.

---

## Étape 12 : UI Components

### Fichiers à créer

Voir UI-DESIGN.md pour la liste complète.

---

## Tests

### Test de non-régression

```bash
bun run type-check:web
bun run type-check:ui
bun run lint:web
bun run lint:ui
```

### Test de compatibilité ascendante

1. Lancer OpenChamber en mode classique
2. Vérifier que chat, terminal, git, sessions fonctionnent
3. Ne jamais activer StudioOS
4. Vérifier qu'aucun store studio.* n'est créé

### Test end-to-end V1

1. Créer un projet vide
2. Activer StudioOS (onboarding)
3. Vérifier que l'organisation est générée
4. Envoyer "Construis un site Next.js"
5. Vérifier que :
   - La tâche racine est créée
   - Le Global CEO décompose
   - Les Department CEOs décomposent
   - Les workers exécutent du code
   - Les fichiers sont créés dans le dossier projet
   - Le Live Dashboard affiche chaque étape
   - Les identités sont sauvegardées
```

