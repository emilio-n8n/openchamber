# Organization Runtime

Le cœur de StudioOS est un sous-système dédié à la gestion des organisations vivantes. Il est composé de six composants interconnectés mais indépendants.

## Architecture du Runtime

```
                  orchestrator.js
                       │
            ┌──────────┴──────────┐
            │                     │
            ▼                     ▼
     event-bus.js            task-queue.js
     (distribution)          (priorité)
            │                     │
            ├── state-machine.js  │
            ├── scheduler.js      │
            └── supervisor.js     │
                  │               │
                  └───────────────┘
                          │
                          ▼
                  execution/provider.js
                          │
                          ▼
                  opencode-provider.js
```

## 1. Event Bus (`event-bus.js`)

### Rôle

Distribuer les événements internes de StudioOS entre les composants. C'est le système nerveux de l'organisation.

### Design

```javascript
// event-bus.js — Internal event distribution
function createEventBus() {

  const listeners = new Map()   // event → Set<handler>
  const history = []            // ring buffer des derniers 1000 événements
  const MAX_HISTORY = 1000

  function subscribe(event, handler) {
    if (!listeners.has(event)) listeners.set(event, new Set())
    listeners.get(event).add(handler)
    return () => listeners.get(event).delete(handler)
  }

  function subscribeAll(handler) {
    // Abonnement wildcard pour le bridging SSE
    return subscribe('*', handler)
  }

  function publish(event, payload) {
    const entry = { event, payload, timestamp: Date.now() }
    history.push(entry)
    if (history.length > MAX_HISTORY) history.shift()

    const handlers = listeners.get(event)
    if (handlers) {
      for (const handler of handlers) {
        try { handler(event, payload) }
        catch (err) { console.error(`[studio:event-bus] Handler failed for ${event}:`, err) }
      }
    }

    // Wildcard handlers
    const wildcardHandlers = listeners.get('*')
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        try { handler(event, payload) }
        catch (err) { console.error(`[studio:event-bus] Wildcard handler failed for ${event}:`, err) }
      }
    }
  }

  function getHistory(lastTimestamp) {
    if (!lastTimestamp) return [...history]
    return history.filter(e => e.timestamp > lastTimestamp)
  }

  return { subscribe, subscribeAll, publish, getHistory }
}
```

### Événements Internes

| Événement | Publieur | Consommateurs |
|---|---|---|
| `task.created` | orchestrator | state-machine, scheduler, supervisor, SSE |
| `task.decomposing` | orchestrator | state-machine, SSE |
| `task.decomposed` | orchestrator | state-machine, task-queue, SSE |
| `task.assigned` | orchestrator | state-machine, scheduler, SSE |
| `task.started` | orchestrator | state-machine, supervisor, SSE |
| `task.activity` | orchestrator/execution | SSE |
| `task.completed` | orchestrator | state-machine, scheduler, supervisor, identity, SSE |
| `task.failed` | orchestrator | state-machine, scheduler, supervisor, SSE |
| `task.cancelled` | orchestrator | state-machine, scheduler, supervisor, SSE |
| `agent.state_changed` | state-machine | SSE |
| `org.updated` | organization | SSE |
| `decision.recorded` | identity | — |
| `identity.evolved` | identity (evolution) | SSE |
| `scheduler.timeout` | scheduler | orchestrator (retry recovery) |
| `supervisor.alert` | supervisor | orchestrator (circuit breaker) |

### Bridging vers le SSE Hub

```javascript
// Dans index.js — un seul abonnement wildcard
eventBus.subscribeAll((event, payload) => {
  if (eventsHub) {
    eventsHub.emit(`studio.${event}`, {
      ...payload,
      timestamp: Date.now(),
    })
  }
})
```

## 2. State Machine (`state-machine.js`)

### Rôle

Garantir que les transitions d'état de l'organisation et des tâches sont valides. Centraliser les règles métier.

### États d'une Tâche

```
    ┌──────────┐
    │  pending  │
    └─────┬────┘
          │
          ▼
    ┌──────────────┐
    │  decomposing  │ ← CEO est en train de réfléchir
    └──────┬───────┘
           │
     ┌─────┴──────┐
     ▼            ▼
┌──────────┐ ┌──────────┐
│ assigned  │ │ failed   │ (si impossible)
└─────┬────┘ └──────────┘
      │
      ▼
┌──────────────┐
│  in_progress  │ ← worker exécute
└──────┬───────┘
       │
    ┌──┴──────┐
    ▼         ▼
┌─────────┐ ┌────────┐
│completed│ │ failed  │
└─────────┘ └───┬────┘
                │
            ┌───┴───┐
            ▼       ▼
         retry    blocked
```

### États d'un Agent

```
┌──────┐
│ idle  │ ← pas de processus, état sauvegardé
└──┬───┘
   │
   ▼
┌──────────┐
│ spawning  │ ← session OpenCode créée
└────┬─────┘
     │
     ▼
┌───────────┐
│ executing  │ ← LLM en train de répondre
└─────┬─────┘
      │
   ┌──┴───────┐
   ▼          ▼
┌──────┐ ┌───────┐
│ done  │ │error  │
└──────┘ └───┬───┘
             │
         ┌───┴───┐
         ▼       ▼
      idle(org)  idle(org)
```

### Implémentation

```javascript
function createStateMachine(eventBus) {

  const VALID_TRANSITIONS = {
    'pending':       ['decomposing'],
    'decomposing':   ['assigned', 'failed'],
    'assigned':      ['in_progress', 'failed'],
    'in_progress':   ['completed', 'failed'],
    'completed':     [],  // état terminal
    'failed':        ['pending', 'blocked'],  // retry possible
    'blocked':       ['pending'],  // débloqué
    'cancelled':     [],
  }

  function transition(task, newStatus) {
    const allowed = VALID_TRANSITIONS[task.status]
    if (!allowed || !allowed.includes(newStatus)) {
      throw new Error(
        `Invalid transition: ${task.status} → ${newStatus}. ` +
        `Allowed: ${allowed?.join(', ') || '(none)'}`
      )
    }
    task.status = newStatus
    eventBus.publish('task.status_changed', { taskId: task.id, status: newStatus })
    eventBus.publish(`task.${newStatus}`, { taskId: task.id })
    return task
  }

  return { transition, VALID_TRANSITIONS }
}
```

## 3. Scheduler (`scheduler.js`)

### Rôle

Gérer les actions différées : timeouts, retry après délai, réveil d'agents, planification.

### Design

```javascript
function createScheduler(eventBus) {

  // File d'attente prioritaire (min-heap par deadline)
  const queue = new MinPriorityQueue({ priority: entry => entry.deadline })
  let timer = null

  function schedule({ type, taskId, delay, data }) {
    const deadline = Date.now() + delay
    queue.enqueue({ type, taskId, deadline, data })
    reschedule()
  }

  function reschedule() {
    if (timer) clearTimeout(timer)
    if (queue.isEmpty()) return

    const next = queue.front()
    const wait = Math.max(0, next.deadline - Date.now())
    timer = setTimeout(() => {
      const due = queue.dequeue()
      eventBus.publish('scheduler.due', due)
      reschedule()
    }, wait)
  }

  // Usage types
  function scheduleTimeout(taskId, timeoutMs) {
    schedule({ type: 'timeout', taskId, delay: timeoutMs })
  }

  function scheduleRetry(taskId, attempt, baseDelayMs = 10000) {
    // Exponential backoff: 10s, 30s, 90s...
    const delay = baseDelayMs * Math.pow(3, attempt - 1)
    schedule({ type: 'retry', taskId, delay, data: { attempt } })
  }

  function scheduleWakeUp(agentId, delayMs) {
    schedule({ type: 'wake_up', delay: delayMs, data: { agentId } })
  }

  function stop() {
    if (timer) clearTimeout(timer)
    queue.clear()
  }

  return { scheduleTimeout, scheduleRetry, scheduleWakeUp, stop }
}
```

### Réveil d'Agent (Wake-Up)

Le scheduler permet le chaînage d'événements :
```
Worker terminé → event-bus.publish('task.completed')
  → scheduler reçoit → planifie réveil du Lead dans 500ms
  → 500ms passent → scheduler.publish('scheduler.due', { type: 'wake_up', agentId: 'tech-lead' })
  → orchestrator crée session pour tech-lead
  → tech-lead: "Validate worker results, decide next steps"
```

## 4. Task Queue (`task-queue.js`)

### Rôle

Gérer la concurrence d'exécution des workers. Prioriser, limiter, ordonnancer.

### Design

```javascript
function createTaskQueue({ maxConcurrency = 3, priorities = ['high', 'normal', 'low'] }) {

  const queues = {
    high: [],
    normal: [],
    low: [],
  }

  const inProgress = new Map()  // taskId → executionHandle
  let activeCount = 0

  function enqueue(task, priority = 'normal') {
    const entry = { task, createdAt: Date.now() }
    queues[priority].push(entry)
    processNext()
    return entry
  }

  async function processNext() {
    if (activeCount >= maxConcurrency) return

    const entry = dequeueHighest()
    if (!entry) return

    activeCount++
    inProgress.set(entry.task.id, entry)

    // Notifie le supervisor
    eventBus.publish('queue.task_dequeued', { taskId: entry.task.id })

    try {
      const result = await executor(entry.task)
      eventBus.publish('task.completed', { taskId: entry.task.id, result })
    } catch (err) {
      eventBus.publish('task.failed', { taskId: entry.task.id, error: err.message })
    } finally {
      inProgress.delete(entry.task.id)
      activeCount--
      processNext()
    }
  }

  function dequeueHighest() {
    for (const priority of ['high', 'normal', 'low']) {
      if (queues[priority].length > 0) return queues[priority].shift()
    }
    return null
  }

  function cancel(taskId) {
    const handle = inProgress.get(taskId)
    if (handle) {
      executionProvider.cancelTask(handle.sessionId)
      inProgress.delete(taskId)
      activeCount--
      processNext()
    }
    // Remove from queues if still pending
    for (const q of Object.values(queues)) {
      const idx = q.findIndex(e => e.task.id === taskId)
      if (idx >= 0) q.splice(idx, 1)
    }
  }

  function getStatus() {
    return {
      activeCount,
      maxConcurrency,
      pending: Object.entries(queues).reduce((acc, [p, q]) => acc + q.length, 0),
      inProgress: [...inProgress.keys()],
    }
  }

  return { enqueue, cancel, getStatus }
}
```

### Règles de Concurrence

| Contexte | Max workers | Raison |
|---|---|---|
| V1 par défaut | 3 | Prouver le concept, limiter les coûts |
| Projet solo | 2-3 | Un seul utilisateur, pas besoin de plus |
| Budget limité | 1 | Éviter les dépassements de coûts |
| Premium | configurable | L'utilisateur choisit |

## 5. Supervisor (`supervisor.js`)

### Rôle

Surveiller la santé de l'organisation. Circuit breakers, détection d'échecs en cascade, alertes.

### Design

```javascript
function createSupervisor({ eventBus, executionProvider }) {

  const taskTimeouts = new Map()     // taskId → deadline
  const failureCount = new Map()     // agentName → consecutive failures
  const circuitBreakers = new Map()  // agentName → { open, openedAt }
  const DEFAULT_TIMEOUT = 5 * 60 * 1000     // 5 min
  const MAX_CONSECUTIVE_FAILURES = 3
  const CIRCUIT_BREAKER_RESET = 30 * 60 * 1000  // 30 min

  // Surveille la durée d'exécution
  eventBus.subscribe('task.started', ({ taskId }) => {
    taskTimeouts.set(taskId, Date.now() + DEFAULT_TIMEOUT)
  })

  eventBus.subscribe('task.completed', ({ taskId }) => {
    taskTimeouts.delete(taskId)
  })

  // Circuit breaker par agent
  eventBus.subscribe('task.failed', ({ taskId, agentName }) => {
    const count = (failureCount.get(agentName) || 0) + 1
    failureCount.set(agentName, count)

    if (count >= MAX_CONSECUTIVE_FAILURES) {
      circuitBreakers.set(agentName, { open: true, openedAt: Date.now() })
      eventBus.publish('supervisor.circuit_open', { agentName, failures: count })

      // Reset automatique après 30 min
      setTimeout(() => {
        circuitBreakers.delete(agentName)
        failureCount.delete(agentName)
        eventBus.publish('supervisor.circuit_closed', { agentName })
      }, CIRCUIT_BREAKER_RESET)
    }
  })

  // Boucle de monitoring
  function start(intervalMs = 10000) {
    setInterval(() => {
      // Vérifie les timeouts
      const now = Date.now()
      for (const [taskId, deadline] of taskTimeouts) {
        if (now > deadline) {
          eventBus.publish('supervisor.timeout', { taskId })
          taskTimeouts.delete(taskId)
        }
      }
    }, intervalMs)
  }

  function isTaskAllowed(task) {
    // Vérifie circuit breaker avant d'assigner
    const breaker = circuitBreakers.get(task.agentName)
    if (breaker?.open) return false
    return true
  }

  return { start, isTaskAllowed, getStatus: () => ({ ... }) }
}
```

### Alertes Supervisor

| Alerte | Cause | Action |
|---|---|---|
| `timeout` | Tâche > 5 min sans terminer | Notifier l'utilisateur, proposer de cancel |
| `circuit_open` | 3 échecs consécutifs sur un agent | Bloquer les nouvelles tâches, alerter |
| `cascade_failure` | Tâche parent + enfants échouent | Marquer le bloc comme "blocked", analyser la cause |
| `budget_warning` (V2) | Coût approche la limite | Ralentir la cadence, notifier |

## Interaction entre les Composants

### Scénario : Un worker échoue

```
Worker X échoue
    │
    ▼
orchestrator publie 'task.failed'
    │
    ▼
event-bus distribue à:
    │
    ├── state-machine → task.status = 'failed'
    │
    ├── supervisor → failureCount[X]++
    │   └── si ≥ 3 → circuit breaker ouvert
    │
    ├── scheduler → planifie retry dans 30s
    │
    ├── task-queue → libère un slot de concurrence
    │
    └── SSE bridge → envoie à l'UI
            │
            ▼
        Live Dashboard :
        "Worker X a échoué. Retry dans 30s..."
```

### Scénario : Un worker termine → Lead réveillé

```
Worker X termine
    │
    ▼
orchestrator publie 'task.completed'
    │
    ▼
event-bus distribue:
    │
    ├── state-machine → task.status = 'completed'
    │               ├── tous les workers du groupe terminés ?
    │               │   ├── OUI → publie 'group.completed'
    │               │   └── NON → attend
    │
    ├── scheduler → si 'group.completed' → planifie réveil Lead
    │
    ├── identity → enregistre la décision réussie
    │
    └── SSE bridge → Live Dashboard:
        "Worker X ✅"
        ...
        "Tech Lead se réveille pour valider..."
```
