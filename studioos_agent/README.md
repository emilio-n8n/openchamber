# StudioOS

## Operating System for AI Organizations

StudioOS transforme OpenChamber d'un client OpenCode en un **Operating System for AI Organizations**. Il ajoute une couche d'intelligence organisationnelle au-dessus du moteur d'exécution existant, sans le réécrire.

### Philosophie

```
Aujourd'hui                          Demain
                                                                
Human                               Human
   │                                    │
Chat                                    │
   │                                    ▼
Agent                              StudioOS
   │                                    │
Code                              Organization
                                      │
                               Departments
                                      │
                                 Managers
                                      │
                                  Workers
                                      │
                                     Code
```

StudioOS ne remplace pas OpenChamber. Il le **complète**. L'utilisateur choisit son mode :

- **Mode OpenChamber** (classique) — comportement actuel, aucune modification
- **Mode StudioOS** (organisation) — orchestration par une organisation IA

### Principe Fondamental

```
┌──────────────────────────────────────────────────┐
│                  STUDIOOS                          │
│                                                     │
│  DÉCIDE : quoi, qui, quand, budget, priorité       │
│  ORGANISE : hiérarchie, départements, rôles        │
│  COORDONNE : délégation, validation, révision      │
│  MÉMORISE : décisions, historique, performances    │
│                                                     │
└────────────────────┬────────────────────────────────┘
                     │ via ExecutionProvider
                     ▼
┌──────────────────────────────────────────────────┐
│                  OPENCODE                          │
│                                                     │
│  EXÉCUTE : outils, terminal, édition               │
│  GÈRE : sessions, agents, permissions              │
│  SANDBOX : worktrees, fichiers, Git                │
│                                                     │
└──────────────────────────────────────────────────┘
```

**StudioOS décide. OpenCode exécute. Jamais l'inverse.**

### Les Trois Piliers

1. **Organization Runtime** — un sous-système dédié avec event-bus, state machine, scheduler, task queue, supervisor
2. **Agents Éphémères** — les rôles sont persistants, les processus sont temporaires (créés à la demande, détruits après la décision)
3. **Identité Persistante** — chaque agent a un nom, des compétences, un historique, des métriques de performance, une personnalité

### ExecutionProvider — L'Interface d'Abstraction

```typescript
interface ExecutionProvider {
  executeTask(request): Promise<TaskHandle>
  cancelTask(taskId): Promise<void>
  getTaskStatus(taskId): Promise<TaskStatus>
  streamTaskEvents(taskId): AsyncIterable<TaskEvent>
  createAgent(definition): Promise<string>
  updateAgent(name, updates): Promise<void>
  deleteAgent(name): Promise<void>
  listAgents(): Promise<AgentInfo[]>
  createWorktree(config): Promise<WorktreeHandle>
  removeWorktree(worktreeId): Promise<void>
  commitChanges(worktreeId, message): Promise<CommitResult>
  getCapabilities(): ExecutionCapabilities
}
```

OpenCode est la première implémentation. Demain : Codex, Claude Code, Devin, A2A, n'importe quel moteur compatible.

### Roadmap

| Phase | Objectif |
|---|---|
| **V1** | Prouver le modèle organisationnel : créer une org, déléguer une tâche, exécuter via OpenCode, dashboard temps réel |
| **V2** | Tâches avancées (Kanban, DAG), mémoire des décisions, budget simple |
| **V3** | Recrutement dynamique (Recruiter agent, matching de compétences) |
| **V4** | Organisation fractale, analytics, auto-réorganisation suggérée |
| **V5** | Validation QA, CI, PRs automatiques |
| **V6** | Parité cross-runtime (desktop, VS Code, mobile) |

### Licence

MIT — même licence qu'OpenChamber.
