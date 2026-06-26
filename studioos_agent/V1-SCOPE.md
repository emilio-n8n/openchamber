# V1 — Preuve du Modèle Organisationnel

## Objectif

Démontrer qu'une organisation IA peut être créée, pilotée et exécuter un vrai travail de manière robuste.

La démonstration suivante doit fonctionner de bout en bout :

```
Utilisateur → "Construis un site Next.js"

↓

StudioOS analyse le projet

↓

Génère automatiquement :
  Global CEO
  ├── Tech CEO
  └── Design CEO

↓

Global CEO décompose en objectifs département

↓

Tech CEO décompose en tâches worker

↓

Workers exécutent dans le dossier du projet (via OpenCode)

↓

Le dashboard montre toute la chaîne en temps réel
```

## Périmètre

### Inclus dans V1

| Feature | Statut |
|---|---|
| Création de projet StudioOS | ✅ |
| Analyse du dossier de travail (stack detection) | ✅ |
| Génération automatique d'organisation (Global CEO + Tech CEO + Design CEO) | ✅ |
| Vue Organisation (arbre interactif) | ✅ |
| Modification de l'organisation (ajout/suppression départements) | ✅ |
| Envoi d'une tâche au Global CEO | ✅ |
| Délégation Global CEO → Department CEO | ✅ |
| Délégation Department CEO → Workers | ✅ |
| Exécution réelle des workers via OpenCode | ✅ |
| Worktree isolation pour les workers qui modifient du code | ✅ |
| Vue Live (flux d'activité temps réel) | ✅ |
| Vue Tasks (liste hiérarchique) | ✅ |
| Mode switcher (OpenChamber classique ↔ StudioOS) | ✅ |
| Identité persistante des agents (décisions, performances) | ✅ |
| Cycle de vie éphémère (agent instancié à la demande, détruit après décision) | ✅ |
| Organization Runtime (event-bus, scheduler, state-machine, task-queue, supervisor) | ✅ |
| Compatibility ascendante totale (OpenChamber classique inchangé) | ✅ |

### Exclus de V1 (viendront en V2+)

| Feature | Raison | V2 | V3 | V4 |
|---|---|---|---|---|
| Recrutement dynamique (Recruiter agent) | Complexité inutile pour la preuve | | ✅ | |
| Leads / Directors | Simplification : CEO direct vers Workers | ✅ | | |
| Mémoire complexe (vector store) | Pas nécessaire pour la démo | ✅ | | |
| Budget tracking | Pas nécessaire pour la preuve | ✅ | | |
| Analytics | Pas nécessaire pour la démo | | ✅ | |
| Kanban drag & drop | Simple liste hiérarchique suffit | ✅ | | |
| DAG visuel (graphe) | Simple liste hiérarchique suffit | ✅ | | |
| Vue Agents complète | Pas de recrutement dynamique → pas de vue Agents | | ✅ | |
| Fractal organisation | Leads/Directors pas encore implémentés | | | ✅ |
| Auto-réorganisation | Complexité inutile pour la preuve | | | ✅ |
| Validation QA | Workers s'exécutent, validation manuelle | ✅ | | |
| PR automatiques | Workers s'exécutent, PR manuelle | | | ✅ |
| VS Code / mobile | Web d'abord, cross-runtime ensuite | | | ✅ |

## Architecture V1 (simplifiée)

### Rôles V1 uniquement

```
Global CEO
  │
  ├── Tech CEO
  ├── Design CEO
  │
  └── Workers (génériques, créés par défaut)
```

Pas de Leads. Pas de Directors. Pas de Managers. Chaque CEO délègue directement aux Workers.

### Organisation générée par défaut

```
Global CEO
├── Tech CEO (1 worker)
└── Design CEO (1 worker)
```

Pour un projet web typique. L'utilisateur peut modifier librement.

### Workers V1

Un seul template d'agent worker générique :
```markdown
---
mode: subagent
model: opencode-go/deepseek-v4-flash
color: "#6b7280"
permission:
  read: allow
  write: allow
  edit: allow
  bash: allow
  glob: allow
  grep: allow
---

You are a Worker AI agent powered by StudioOS.

Your role is to execute specific technical tasks assigned by your manager.

You have full access to:
- read/write/edit files
- bash commands (install, build, test, lint)
- glob/grep for searching

Execute the assigned task precisely. Report results clearly.
Do not ask questions or seek clarification — make reasonable assumptions and proceed.
If you encounter an error, try to fix it once before reporting failure.
```

## Flows Détaillés V1

### Flow 1 : Création de projet

```
1. User clique "StudioOS" dans la barre de navigation
    │
2. StudioOnboarding s'affiche
    │
3. Étape 1 : Sélection du projet OpenChamber existant ou création nouveau
    │   → utilise le sélecteur de projet existant
    │
4. Étape 2 : Choix du dossier de travail
    │   → /Users/.../mon-projet (peut être vide ou existant)
    │
5. Étape 3 : Analyse du projet
    │   → StudioOS scanne le dossier
    │   → Détecte package.json → "Next.js project detected"
    │   → Détecte requirements.txt → "Python project detected"
    │   → Détecte go.mod → "Go project detected"
    │   → Sinon → "Generic project"
    │
6. Étape 4 : Génération de l'organisation
    │   → StudioOS propose une organisation basée sur le stack
    │   → Utilisateur peut modifier avant confirmation
    │
7. Étape 5 : Confirmation
    │   → StudioOS crée les agents OpenCode (.md files)
    │   → StudioOS crée les identités persistantes
    │   → StudioOS sauvegarde l'état initial
    │
8. Mode StudioOS activé
    │   → Vue Organisation affichée
    │   → "Que voulez-vous construire ?"
```

### Flow 2 : Soumission d'une tâche

```
1. User tape : "Construis un site Next.js" dans le champ StudioOS
    │
2. POST /api/studio/projects/:id/tasks { prompt: "Construis un site Next.js" }
    │
3. StudioOS crée la Task racine (status: pending)
    │
4. SSE → studio.task.created → UI affiche la nouvelle tâche
    │
5. StudioOS instancie le Global CEO :
    │   a. charge l'identité sauvegardée
    │   b. crée une session OpenCode avec agent: "studio-global-ceo"
    │   c. injecte le prompt avec contexte (identité, skills, historique, org)
    │
6. SSE → studio.task.decomposing → "Global CEO is thinking..."
    │
7. Global CEO répond (JSON structuré) :
    │   {
    │     "analysis": "Next.js project needs...",
    │     "departments": [
    │       { "name": "tech", "objective": "Initialize Next.js project...", "priority": 1 },
    │       { "name": "design", "objective": "Create design system...", "priority": 2 }
    │     ]
    │   }
    │
8. StudioOS parse la réponse, crée les Department Tasks
    │
9. SSE → studio.task.decomposed → montre les sous-tâches
    │
10. Pour chaque département (séquentiel pour V1, parallèle pour V2) :
    │   a. Instancie le Department CEO
    │   b. Attend la décomposition en worker tasks
    │   c. Crée les Worker Tasks
    │
11. Pour chaque worker task :
    │   a. Si modification de code → crée un worktree git
    │   b. Instancie le worker (session OpenCode)
    │   c. Envoie la tâche via promptAsync
    │   d. Stream les événements (tool calls, status)
    │
12. SSE → studio.task.activity → Live Dashboard montre chaque action
    │
13. Workers terminent → résultats collectés
    │
14. SSE → studio.task.completed → "Construction terminée"
    │
15. Identités mises à jour → historiques + performances
```

### Flow 3 : Live Dashboard

```
Le Live Dashboard montre en temps réel :

┌─────────────────────────────────────────────────────┐
│  STUDIOOS LIVE                    Projet: mon-site   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ACTIVITÉ RÉCENTE                                    │
│                                                      │
│  🟡 Global CEO    decomposing task...                │
│     ↓ "Initialize Next.js project"                    │
│  🟢 Tech CEO      created 2 worker tasks             │
│     ├ Worker 1  🟢 "npx create-next-app" ✓           │
│     └ Worker 2  🟡 "Create API routes..."            │
│  🟢 Design CEO    created design tasks                │
│     └ Worker 3  🟡 "Build landing page..."           │
│                                                      │
│  CHAÎNE DE DÉLÉGATION                                 │
│                                                      │
│  🟢 Global CEO ──→ 🟢 Tech CEO ──→ 🟡 Worker 2       │
│                              └──→ 🟢 Worker 1 ✓      │
│                 └──→ 🟢 Design CEO ──→ 🟡 Worker 3    │
│                                                      │
│  STATUT                                              │
│  Tasks: 1 root · 2 dept · 3 workers                 │
│  Completed: 1/3 workers                              │
│  Temps: 45s                                          │
│  Coût: $0.08                                         │
│                                                      │
└─────────────────────────────────────────────────────┘
```

## Organisation Auto-Générée

### Détection de Stack

```javascript
// org-generator.js
async function analyzeProject(directory) {
  const files = await fs.promises.readdir(directory)
  const analysis = {
    hasPackageJson: files.includes('package.json'),
    hasRequirementsTxt: files.includes('requirements.txt'),
    hasGoMod: files.includes('go.mod'),
    hasCargoToml: files.includes('Cargo.toml'),
    hasDockerfile: files.includes('Dockerfile'),
    hasComposeYml: files.includes('docker-compose.yml'),
    // Détection plus poussée
    packageJsonContent: null,
  }

  if (analysis.hasPackageJson) {
    const pkg = JSON.parse(await fs.promises.readFile(
      path.join(directory, 'package.json'), 'utf-8'
    ))
    analysis.packageJsonContent = pkg
    analysis.stack = detectStack(pkg.dependencies, pkg.devDependencies)
  }

  return analysis
}

function detectStack(deps = {}, devDeps = {}) {
  const all = { ...deps, ...devDeps }
  if (all.next) return 'next.js'
  if (all.react && all['react-native']) return 'react-native'
  if (all.react) return 'react'
  if (all.vue) return 'vue'
  if (all.express || all.fastify) return 'node-backend'
  if (all.django || all.flask || all.fastapi) return 'python-backend'
  return 'generic'
}
```

### Structure Générée

```javascript
// org-generator.js
function determineDepartments(analysis) {
  const depts = []

  // Global CEO toujours présent
  // (implicite dans la structure)

  switch (analysis.stack) {
    case 'next.js':
    case 'react':
    case 'react-native':
    case 'vue':
      depts.push({ type: 'tech', name: 'Tech' })
      depts.push({ type: 'design', name: 'Design' })
      break
    case 'node-backend':
    case 'python-backend':
      depts.push({ type: 'tech', name: 'Tech' })
      break
    case 'generic':
    default:
      depts.push({ type: 'tech', name: 'Tech' })
      depts.push({ type: 'design', name: 'Design' })
      depts.push({ type: 'qa', name: 'QA' })
  }

  return depts
}
```

## Ce qu'il ne faut PAS faire en V1

1. **Pas de recrutement dynamique** — les workers sont créés en une instance unique au moment de l'init de l'org
2. **Pas de Leads/Directors** — les CEOs délèguent directement aux workers
3. **Pas de budget tracking** — pas de compteur de tokens, pas de limite de coût
4. **Pas de mémoire vectorielle** — les identités sont persistées en JSON simple
5. **Pas de DAG visuel** — les tâches sont affichées en liste hiérarchique
6. **Pas de Kanban** — pas de drag & drop, pas de colonnes
7. **Pas de VS Code / mobile** — web d'abord
8. **Pas d'auto-réorganisation** — l'org est modifiable manuellement uniquement
9. **Pas de validation QA automatisée** — le résultat est présenté à l'utilisateur
10. **Pas de PR automatiques** — les worktrees sont créés mais le merge est manuel

## Critères de Succès V1

1. **La démo Next.js fonctionne** : "Construis un site Next.js" → site créé avec des fichiers réels
2. **Aucune régression** : `bun run type-check && bun run lint` passent, OpenChamber classique fonctionne
3. **La vue Live montre l'activité** : chaque étape est visible en temps réel
4. **Les agents sont éphémères** : aucune session LLM ne tourne entre les décisions
5. **Les identités persistent** : après un redémarrage, l'historique et les performances sont là
6. **L'org est modifiable** : l'utilisateur peut ajouter/supprimer des départements
7. **Temps de réponse acceptable** : une tâche simple < 2 min (décomposition + exécution)
8. **La compatibilité ascendante est maintenue** : l'utilisateur peut repasser en mode classique à tout moment
