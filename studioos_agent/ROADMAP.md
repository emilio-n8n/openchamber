# Roadmap StudioOS — V1 à V6

## Vue d'Ensemble

```
V1 (4-6 sem)     V2 (4-6 sem)      V3 (4-6 sem)      V4 (6-8 sem)      V5 (4-6 sem)      V6 (4-6 sem)
                                                                                              
Foundation       Tasks              Recrutement        Fractal &          Validation         Cross-Runtime
du modèle        Avancées           Dynamique          Analytics          & CI                & Polish
                                    
Preuve que       Kanban + DAG       Recruiter          Sous-orgs          QA CEO             VS Code
l'org peut       + Mémoire          + Matching         + Analytics        + PRs auto          + Desktop
marcher          des décisions      de compétences     + Auto-réorg       + Tests              + Mobile
```

**Total estimé : 28-36 semaines de développement** pour une version complète.

---

## V1 — Preuve du Modèle Organisationnel

**Objectif** : Démontrer qu'une organisation IA peut être créée, pilotée et exécuter un vrai travail.

**Durée estimée** : 4-6 semaines

### Deliverables

| Module | Contenu | Priorité |
|---|---|---|
| `lib/studio/runtime/` | event-bus, state-machine, scheduler, task-queue, supervisor | P0 |
| `lib/studio/orchestrator.js` | Flow CEO → Dept → Worker | P0 |
| `lib/studio/organization.js` | CRUD org + persistence | P0 |
| `lib/studio/tasks.js` | CRUD tâches + hiérarchie | P0 |
| `lib/studio/delegation.js` | Prompts CEOs + parsing JSON | P0 |
| `lib/studio/org-generator.js` | Stack detection + auto-org | P0 |
| `lib/studio/identity/` | AgentIdentity, history, evolution | P0 |
| `lib/studio/execution/` | ExecutionProvider + OpenCode impl | P0 |
| `lib/studio/routes.js` | API REST /api/studio/* | P0 |
| `lib/studio/persistence.js` | Atomic write/read | P1 |
| Templates agents | global-ceo, tech-ceo, design-ceo, worker | P0 |
| `useStudioStore` | Mode switcher, projets | P0 |
| `useOrganizationStore` | Org + départements + agents | P0 |
| `useStudioTaskStore` | Tasks + status | P0 |
| `studio-sync.ts` | Handler events studio.* | P1 |
| `OrganizationView` | Arbre interactif | P0 |
| `StudioTasksView` | Liste hiérarchique | P1 |
| `StudioLiveView` | Flux temps réel | P0 |
| `StudioOnboarding` | Création projet + génération org | P0 |
| Modifications cœur | MainTab, VALID_TABS, routes, layout | P0 |

### Risques V1

| Risque | Mitigation |
|---|---|
| Parsing JSON CEO instable | Prompt strict + retry + Zod fallback |
| Worktree isolation bug | Réutiliser le code multi-run existant |
| Session OpenCode ne stream pas | Utiliser streamTaskEvents (existant) |
| Coût LLM trop élevé | Limiter à 1 CEO + 2 workers max |

### Dépendances V1

- Aucune dépendance externe nouvelle
- Réutilise : `@opencode-ai/sdk`, `simple-git`, `zustand`, `express`, `zod`
- Réutilise les worktrees de `packages/web/server/lib/git/service.js`

---

## V2 — Tâches Avancées & Mémoire

**Objectif** : Système de tâches complet (Kanban + DAG) + mémoire des décisions + budget simple.

**Durée estimée** : 4-6 semaines

### Ajouts

| Feature | Complexité |
|---|---|
| Vue Tasks Kanban (drag & drop, colonnes status) | Haute |
| Vue DAG visuel (graphe de dépendances avec `reactflow` ou `dagre`) | Haute |
| Dépendances entre tâches (Tâche B dépend de Tâche A) | Moyenne |
| Ordre d'exécution automatique (dépendances → scheduler) | Moyenne |
| Mémoire des décisions (pourquoi une approche a été choisie) | Moyenne |
| Contexte de projet persistant (entre sessions) | Moyenne |
| Budget simple (compteur de tokens/coût par département) | Moyenne |
| Alertes de dépassement (toast quand budget approche la limite) | Faible |
| Annulation de tâches (cancelTask) | Faible |
| Retry automatique (tâche échouée → 3 tentatives) | Faible |

### Dépendances externes V2

| Dépendance | Usage |
|---|---|
| `reactflow` ou `@xyflow/react` | Graphe DAG visuel |
| `p-queue` | Gestion fine de concurrence |

### Flux V2 ajouté

```
Worker terminé → Lead réveillé (scheduler.wakeUp)
  → Lead valide le résultat
  → Si OK → prochaine tâche de la dépendance
  → Si KO → retry worker (max 3)
  → Décision enregistrée dans la mémoire
```

---

## V3 — Recrutement Dynamique

**Objectif** : Le Recruiter analyse les besoins et crée des agents spécialisés à la demande.

**Durée estimée** : 4-6 semaines

### Ajouts

| Feature | Complexité |
|---|---|
| Agent Recruiter (analyse compétences requises depuis la tâche) | Très haute |
| Génération dynamique d'agents (nouveau .md via API) | Haute |
| Matching de compétences (skills catalog reuse) | Haute |
| Agents multi-fournisseurs (Worker A = Claude, Worker B = GPT) | Moyenne |
| Vue Agents (liste complète, filtre par département, status) | Haute |
| Cycle de vie des agents (actif, veille, supprimé) | Moyenne |
| Profils d'agents persistants (identité + skills + historique) | Moyenne |

### Flux V3

```
CEO : "J'ai besoin d'un spécialiste PostgreSQL"
    │
    ▼
Recruiter (agent OpenCode, mode: all)
    │
    ├── Analyse la tâche → compétences requises
    ├── Cherche dans les profils existants
    │   ├── Trouvé → réactive l'agent
    │   └── Pas trouvé → crée un nouvel agent
    │       ├── Génère le .md (prompt + permissions + modèle)
    │       ├── Appelle POST /api/config/agents/:name
    │       └── Ajoute l'agent au département
    │
    ▼
Nouveau worker disponible pour les tâches
```

### Dépendances externes V3

| Dépendance | Usage |
|---|---|
| Aucune nouvelle | Réutilise agents.js routes existantes |

---

## V4 — Organisation Fractale & Analytics

**Objectif** : Chaque manager peut créer sa propre sous-organisation. Analytics complètes.

**Durée estimée** : 6-8 semaines

### Ajouts

| Feature | Complexité |
|---|---|
| Organisation fractale (un CEO crée ses sub-départements) | Très haute |
| Sous-arbres éditables (drag & drop, rename) | Haute |
| Vue Analytics (temps, coût, performance, modèles) | Haute |
| Charge par département (workers actifs, tâches en cours) | Moyenne |
| Historique complet (audit trail de toutes les décisions) | Moyenne |
| Auto-réorganisation suggérée (basée sur performance metrics) | Haute |
| Budgets avancés (allocation, alertes, plafonds par département) | Haute |

### Flux V4

```
Tech CEO surchargé (10 workers actifs)
    │
    ▼
StudioOS détecte la charge (supervisor)
    │
    ▼
Suggère une réorganisation :
  "Tech CEO, voulez-vous créer un sous-département Backend ?"
    │
    ▼
Tech CEO crée Backend Lead
    │
    ▼
Backend Lead recrute 3 workers backend (via Recruiter)
    │
    ▼
Organisation évoluée :
  Tech CEO
  ├── Frontend Lead (3 workers)
  └── Backend Lead (3 workers)
```

### Dépendances externes V4

| Dépendance | Usage |
|---|---|
| Chart lib (`recharts` ou `chart.js`) | Analytics graphs |

---

## V5 — Validation QA & Intégration Continue

**Objectif** : QA CEO valide le travail des workers, lance les tests, ouvre des PRs.

**Durée estimée** : 4-6 semaines

### Ajouts

| Feature | Complexité |
|---|---|
| QA CEO (validation des résultats worker) | Haute |
| Flow de validation : Worker → QA → Approbation/Rejet | Haute |
| Création automatique de Pull Requests (via GitHub routes) | Haute |
| Revue de code automatisée (réutilise pr-review.md existant) | Moyenne |
| Merge de worktrees (intégration des changements) | Moyenne |
| Exécution de tests (npm test, pytest, go test) | Moyenne |

### Flux V5

```
Tous les workers du département terminent
    │
    ▼
QA CEO réveillé (scheduler)
    │
    ├── Vérifie les résultats
    ├── Lance les tests (bash "npm test")
    ├── Vérifie la couverture
    │
    ├── Si OK :
    │   ├── Merge les worktrees
    │   ├── Crée une PR (via /api/github/*)
    │   └── Notifie l'utilisateur
    │
    └── Si KO :
        ├── Renvoie au worker concerné
        └── Nouveau cycle
```

---

## V6 — Parité Cross-Runtime & Polish

**Objectif** : StudioOS fonctionne sur desktop, VS Code, et mobile.

**Durée estimée** : 4-6 semaines

### Ajouts

| Feature | Complexité |
|---|---|
| VS Code : vues Studio dans la webview | Haute |
| VS Code : bridge pour ExecutionProvider | Haute |
| Desktop : notifications natives pour événements Studio | Moyenne |
| Desktop : mini-chat avec contexte Studio | Moyenne |
| Mobile : dashboard Studio simplifié | Haute |
| Optimisation performance (event coalescing studio.*) | Moyenne |
| Internationalisation (FR/EN labels Studio) | Moyenne |
| Documentation utilisateur complète | Moyenne |

---

## Synthèse des Dépendances par Phase

| Phase | Nouvelles dépendances | Lignes estimées | Modules |
|---|---|---|---|
| V1 | Aucune | 8000-12000 | 7 backend + 4 frontend |
| V2 | `reactflow`, `p-queue` | 5000-7000 | 2 backend + 2 frontend |
| V3 | Aucune | 5000-7000 | 2 backend + 2 frontend |
| V4 | `recharts` | 6000-8000 | 2 backend + 2 frontend |
| V5 | Aucune | 4000-5000 | 1 backend + 1 frontend |
| V6 | Aucune | 3000-4000 | Bridge + UI adapt |

**Total : 31 000 - 47 000 lignes de code** sur 6 phases.

## Règles de la Roadmap

1. **Chaque phase est autonome** — utilisable et testable indépendamment
2. **Aucune phase ne casse la précédente** — rétrocompatibilité totale
3. **Les phases peuvent être parallélisées** — V2 + V3 peuvent être développés en même temps par des équipes séparées
4. **Le périmètre peut être réduit** — si V2 est trop ambitieux, on coupe le DAG visuel pour le V2+1
5. **La V1 valide l'architecture** — si la V1 est stable, les phases suivantes sont des ajouts de features, pas des refontes
