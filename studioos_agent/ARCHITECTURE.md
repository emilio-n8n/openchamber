# Architecture StudioOS

## Vue d'Ensemble

```
┌──────────────────────────────────────────────────────────────────┐
│                        UTILISATEUR                                │
│  ┌─────────────┐  ┌──────────────┐  ┌────────┐  ┌───────────┐   │
│  │ Chat        │  │ Organization │  │ Tasks  │  │ Live      │   │
│  │ (classique) │  │ Tree         │  │ Kanban │  │ Dashboard │   │
│  └─────────────┘  └──────────────┘  └────────┘  └───────────┘   │
└─────────────────────────┬────────────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────────────┐
│                      UI LAYER (React/Zustand)                     │
│                                                                   │
│  stores/                                    components/          │
│  ├── useStudioStore.ts                      ├── studio/          │
│  ├── useOrganizationStore.ts                │   ├── OrgTree      │
│  └── useStudioTaskStore.ts                  │   ├── OrgNode      │
│                                             │   ├── TaskCard     │
│  sync/                                      │   ├── LiveFeed    │
│  └── studio-sync.ts ← studio.* SSE events   │   └── ...          │
└─────────────────────────┬────────────────────────────────────────┘
                          │ HTTP /api/studio/*
                          │ SSE /studio/live
┌─────────────────────────▼────────────────────────────────────────┐
│                    SERVER LAYER (Express)                          │
│                                                                   │
│  lib/studio/                                                      │
│  ├── index.js             → createStudioRuntime()                 │
│  ├── routes.js            → /api/studio/* endpoints               │
│  ├── events.js            → studio.* SSE emission                 │
│  │                                                                │
│  ├── runtime/             → Organization Runtime                   │
│  │   ├── runtime.js       → composition, startup, shutdown        │
│  │   ├── event-bus.js     → event distribution (publish/subscribe)│
│  │   ├── state-machine.js → org & task state transitions          │
│  │   ├── scheduler.js     → timeouts, wake-ups, retries           │
│  │   ├── task-queue.js    → priority queue, concurrency limits     │
│  │   └── supervisor.js    → health checks, circuit breakers       │
│  │                                                                │
│  ├── orchestrator.js      → CEO→Dept→Worker flow                  │
│  ├── organization.js      → org CRUD + persistence                │
│  ├── tasks.js             → task CRUD + DAG                       │
│  ├── delegation.js        → prompt building + response parsing     │
│  ├── org-generator.js     → auto-org from project analysis        │
│  ├── persistence.js       → atomic write/read state               │
│  │                                                                │
│  ├── identity/            → Agent Identity System                  │
│  │   ├── identity.js      → AgentIdentity model + CRUD            │
│  │   ├── history.js       → decision tracking (append-only)       │
│  │   └── evolution.js     → performance metrics, promotions       │
│  │                                                                │
│  └── execution/           → Execution Provider Abstraction         │
│      ├── provider.js      → ExecutionProvider interface            │
│      └── opencode-provider.js → OpenCode implementation            │
│                                                                │
└─────────────────────────┬────────────────────────────────────────┘
                          │ via ExecutionProvider
┌─────────────────────────▼────────────────────────────────────────┐
│                   OPENCODE SERVER (non modifié)                    │
│                                                                   │
│  Agents (studio-*) → promptAsync → exécution → résultat           │
│  Tools (read, write, edit, bash, git)                             │
│  Sessions (parent/child, metadata)                                │
│  Worktrees (git isolation)                                        │
│  SSE Events (session status, message parts)                       │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

## Séparation des Responsabilités

### StudioOS (cerveau) — décide

| Responsabilité | Composant | Pourquoi pas dans OpenCode |
|---|---|---|
| Organisation structure | `organization.js` | OpenCode ne connaît pas les départements |
| Décisions de décomposition | `orchestrator.js` + CEOs (LLM) | OpenCode exécute, il ne planifie pas |
| État global | `state-machine.js` | L'état d'org est orthogonal aux sessions |
| Routage des tâches | `task-queue.js` | OpenCode n'a pas de notion de priorité |
| Budget | `supervisor.js` (V2) | Coût global, pas par session |
| Mémoire décisionnelle | `identity/` | Décisions traversent les sessions |
| Planification temporelle | `scheduler.js` | Timeouts, retry, réveil différé |
| Événements internes | `event-bus.js` | Chaînage d'événements (worker fini → QA réveillé) |

### OpenCode (moteur) — exécute

| Responsabilité | Pourquoi dans OpenCode |
|---|---|
| Exécution des agents | LLM, outils, permissions — existant |
| Édition de fichiers | `read`, `write`, `edit` — existant |
| Commandes shell | `bash`, terminal — existant |
| Git / worktrees | `simple-git`, multi-run — existant |
| Sécurité | Permission rules, sandbox — existant |
| Streaming temps réel | SSE/WS event pipeline — existant |

### Règle d'Or

> StudioOS ne doit jamais dupliquer ce qu'OpenCode fait déjà.
> 
> Si OpenCode peut le faire (lancer un agent, éditer un fichier, créer un worktree, streamer un événement), StudioOS le fait via OpenCode.
>
> StudioOS n'ajoute que ce qui n'existe pas : organisation, gouvernance, orchestration, mémoire.

## Flux d'Exécution Complet (V1)

```
User: "Construis un site Next.js"
  │
  ├── POST /api/studio/projects/:id/tasks
  │     body: { prompt: "Construis un site Next.js" }
  │
  ▼
routes.js → orchestrator.submitTask(projectId, prompt)
  │
  ├── 1. tasks.js → createTask({ type: 'root', title: prompt })
  │
  ├── 2. runtime/event-bus.js → publish('task.created', task)
  │         │
  │         ├── state-machine.js → task.status = 'decomposing'
  │         └── supervisor.js → start monitoring
  │
  ├── 3. orchestration Bureau:
  │      a. executionProvider.executeTask({
  │           agent: 'studio-global-ceo',
  │           prompt: buildCeoPrompt(prompt, org, identity),
  │         })
  │      b. for await (event of executionProvider.streamTaskEvents(handle.id)) {
  │           event-bus.publish('ceo.thinking', event)
  │         }
  │      c. CEO répond → parseCeoResponse(output) → [{ department, objective }]
  │      d. event-bus.publish('task.decomposed', { task, departments })
  │
  ├── 4. Pour chaque département:
  │      a. tasks.createTask({ type: 'department', parentId, department, ... })
  │      b. executionProvider.executeTask({
  │           agent: 'studio-tech-ceo',
  │           prompt: buildDeptCeoPrompt(deptObjective, identity),
  │         })
  │      c. Attend la réponse → worker task definitions
  │      d. Pour chaque worker:
  │           ├── tasks.createTask({ type: 'worker', parentId, ... })
  │           ├── Si worktree: executionProvider.createWorktree({ directory, branch })
  │           ├── executionProvider.executeTask({
  │           │     agent: 'studio-worker',
  │           │     prompt: buildWorkerPrompt(workerTask, context),
  │           │   })
  │           ├── for await (event of streamTaskEvents) {
  │           │     event-bus.publish('task.activity', { task, activity: event })
  │           │   }
  │           └── event-bus.publish('task.completed', { task, result })
  │
  ├── 5. Tous les workers terminés → event-bus.publish('task.completed', rootTask)
  │
  └── 6. Identity mise à jour:
        identity.history.push({ taskId, outcome, summary })
        identity.performance = recalculateMetrics()
        persistence.saveIdentity(identity)
```

## Flux d'Événements Interne (Event Bus)

```
                    event-bus.js
                         │
         ┌───────────────┼────────────────────┐
         │               │                    │
         ▼               ▼                    ▼
   state-machine     scheduler           supervisor
   (transitions)     (timeouts)          (health)
         │               │                    │
         │    ┌──────────┘                    │
         │    │                               │
         ▼    ▼                               ▼
   task-queue.js                          orchestration Bureau
   (priorité)                             (reprise sur erreur)
```

### Événements Publiques (SSE → UI)

| Événement | Payload | Quand |
|---|---|---|
| `studio.organization.created` | `{ organization }` | Organisation générée |
| `studio.organization.updated` | `{ diff }` | Org modifiée par l'utilisateur |
| `studio.task.created` | `{ task }` | Nouvelle tâche créée |
| `studio.task.decomposing` | `{ taskId, agentName }` | CEO commence à réfléchir |
| `studio.task.decomposed` | `{ taskId, children: Task[] }` | CEO a décomposé |
| `studio.task.assigned` | `{ taskId, agentId }` | Tâche assignée à un worker |
| `studio.task.started` | `{ taskId, sessionId, worktree? }` | Worker commence l'exécution |
| `studio.task.activity` | `{ taskId, tool, input, output }` | Worker fait un tool call |
| `studio.task.completed` | `{ taskId, result, summary }` | Tâche réussie |
| `studio.task.failed` | `{ taskId, error }` | Tâche échouée |
| `studio.agent.state_changed` | `{ agentId, state }` | Statut d'agent changé |
| `studio.identity.updated` | `{ agentId, performance }` | Métriques mises à jour |

## Composition du Runtime (index.js)

```javascript
// lib/studio/index.js
function createStudioRuntime({ opencodeClient, gitService, eventHub, projectConfig }) {

  // 1. Infrastructure
  const persistence = createPersistence(projectConfig)
  const identity = createIdentitySystem(persistence)
  const eventBus = createEventBus()
  const stateMachine = createStateMachine(eventBus)
  const scheduler = createScheduler(eventBus)
  const taskQueue = createTaskQueue({ maxConcurrency: 3 })
  const supervisor = createSupervisor({ eventBus, executionProvider })

  // 2. Execution Provider
  const executionProvider = createOpenCodeExecutionProvider({
    opencodeClient,
    gitService,
    eventBus,  // pour streamer les événements d'exécution
  })

  // 3. Orchestrator
  const orchestrator = createOrchestrator({
    executionProvider,
    eventBus,
    identity,
    stateMachine,
    taskQueue,
  })

  // 4. Organization manager
  const orgManager = createOrganizationManager({
    persistence,
    executionProvider,
    identity,
    eventBus,
  })

  // 5. Abonnement event-bus → SSE hub
  eventBus.subscribe('*', (event, payload) => {
    eventHub.emit(`studio.${event}`, {
      ...payload,
      timestamp: Date.now(),
    })
  })

  // 6. Supervisor monitoring loop
  supervisor.start()

  // 7. API publique
  return {
    submitTask: orchestrator.submitTask,
    cancelTask: orchestrator.cancelTask,
    getOrganization: orgManager.getOrganization,
    updateOrganization: orgManager.updateOrganization,
    generateOrganization: orgManager.generateOrganization,
    listTasks: orchestrator.listTasks,
    getTask: orchestrator.getTask,
    getAgentIdentity: identity.getIdentity,
    listAgentIdentities: identity.listIdentities,
    getLiveStream: (projectId) => eventBus.subscribeForSSE(projectId),
    stop: () => { supervisor.stop(); scheduler.stop(); },
  }
}
```

## Compatibilité Ascendante

### Ce qui ne change jamais

- `packages/ui/src/App.tsx` — inchangé
- `packages/ui/src/components/chat/` — inchangé
- `packages/ui/src/components/session/` — inchangé
- `packages/ui/src/sync/event-pipeline.ts` — inchangé (les events `studio.*` passent par le même hub)
- `packages/web/server/` — 1 ligne ajoutée pour les routes
- `packages/electron/` — inchangé
- `packages/vscode/` — inchangé

### Ce qui change (additif)

- `packages/ui/src/stores/useUIStore.ts` — `MainTab` + `'studio'`
- `packages/ui/src/components/layout/MainLayout.tsx` — `case 'studio'`
- `packages/web/server/lib/opencode/feature-routes-runtime.js` — `registerStudioRoutes()`
- Total : ~30 lignes additives

### Le test de non-régression

Si StudioOS n'est jamais activé sur une installation :
- Aucun store `studio.*` n'est créé
- Aucune route `/api/studio/*` n'est appelée
- Aucun événement `studio.*` n'est émis ou traité
- Aucun agent `studio-*` n'est créé
- OpenChamber fonctionne exactement comme avant
