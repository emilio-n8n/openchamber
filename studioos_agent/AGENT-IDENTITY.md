# Agent Identity System

## Philosophie

> Les CEO, Managers et Workers sont des **rôles persistants**, pas des **processus persistants**.
>
> L'identité est sauvegardée sur disque.
> L'instance d'exécution (session OpenCode) est créée à la demande et détruite après chaque décision.
> Aucun LLM ne tourne en arrière-plan sans raison.

## Principe : Éphéméralité

```
                        ÉTAT SAUVEGARDÉ (disque)
                        ┌──────────────────────────┐
                        │ AgentIdentity             │
                        │ - role: tech-ceo          │
                        │ - skills: [typescript...] │
                        │ - decisions: [...]        │
                        │ - performance: {...}      │
                        │ - iteration: 42           │
                        └──────────────────────────┘
                                │
                    DÉCISION NÉCESSAIRE
                                │
                                ▼
                        INSTANCIATION
                        ┌──────────────────────────┐
                        │ Session OpenCode          │
                        │ - agent: studio-tech-ceo  │
                        │ - prompt: "Décompose..."  │
                        │ - context: identity + org │
                        │ → LLM répond (JSON)       │
                        │ → session détruite        │
                        └──────────────────────────┘
                                │
                        SAUVEGARDE
                        ┌──────────────────────────┐
                        │ Ajout à identity          │
                        │ - nouvelle décision       │
                        │ - mise à jour perf        │
                        │ - skills évoluent         │
                        └──────────────────────────┘
                                │
                                ▼
                        IDLE (0 processus)
```

### Pourquoi l'éphéméralité est cruciale

| Sans éphéméralité | Avec éphéméralité |
|---|---|
| 800 agents "vivants" en permanence | 0 à 3 processus simultanés |
| Contexte LLM coûteux qui brûle des tokens | Contexte injecté à la demande, optimisé |
| Crash = perte d'état | Crash = dernière identité sauvegardée |
| Scalabilité = coût × nombre d'agents | Scalabilité = coût × nombre de décisions |
| Impossible d'avoir 100+ rôles | Possible d'avoir 1000+ rôles (coût ~0 à l'arrêt) |

## Modèle de Données

```typescript
// ─── IDENTITÉ D'UN AGENT ───
interface AgentIdentity {
  // Identification
  role: AgentRole
  department: DepartmentType
  agentName: string                    // nom de l'agent OpenCode (studio-tech-ceo)
  instanceId: string                   // identifiant unique (tech-ceo-2026-07-01)

  // Caractéristiques persistantes
  name: string                         // "Tech CEO"
  personality: string                  // "Analytical, decisive, delegative"
  managementStyle: string              // "Goal-oriented, high-trust"
  specialization: string               // "Full-stack web development"

  // Compétences évolutives
  skills: Skill[]

  // Historique des décisions (append-only)
  decisions: DecisionRecord[]

  // Métriques de performance
  performance: PerformanceMetrics

  // Cycle de vie
  iteration: number                    // nombre de fois que cet agent a été instancié
  createdAt: number
  lastDecisionAt: number
  version: number                      // version du modèle d'identité
  status: 'active' | 'paused' | 'retired' | 'promoted'
}

type AgentRole =
  | 'global-ceo'
  | 'dept-ceo'
  | 'director'       // V2+
  | 'lead'           // V2+
  | 'manager'        // V2+
  | 'worker'
  | 'recruiter'      // V3+

type DepartmentType =
  | 'tech'
  | 'design'
  | 'qa'
  | 'product'
  | 'operations'
  | 'production'
  | 'general'        // pour Global CEO


// ─── COMPÉTENCES ───
interface Skill {
  name: string
  level: SkillLevel
  lastUsed: number                     // timestamp
  confidence: number                   // 0-1, basé sur les résultats
}

type SkillLevel =
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'expert'
  | 'master'


// ─── DÉCISIONS ───
interface DecisionRecord {
  taskId: string
  timestamp: number
  summary: string                      // résumé court (max 200 chars)
  outcome: 'success' | 'failure' | 'partial'
  confidence: number                   // auto-évalué 0-1
  tokensUsed: number
  cost: number                         // coût estimé
  detailsRef?: string                  // chemin vers le fichier de décision complet (optionnel)
}


// ─── PERFORMANCE ───
interface PerformanceMetrics {
  tasksCompleted: number
  tasksFailed: number
  successRate: number                  // completed / (completed + failed)
  avgConfidence: number                // moyenne mobile
  avgTokens: number                    // moyenne mobile
  avgCost: number                      // coût moyen par décision
  totalCost: number                    // coût total cumulé
  promotionScore: number               // 0-100
  experienceLevel: ExperienceLevel
  decisionsLast30d: number             // vélocité récente
}

type ExperienceLevel =
  | 'junior'       // 0-20  décisions
  | 'mid'          // 21-100 décisions
  | 'senior'       // 101-500 décisions
  | 'lead'         // 501+ décisions
  | 'executive'    // 1000+ décisions + taux succès > 0.9
```

## Cycle de Vie Complet

### 1. Création

```javascript
// identity/identity.js
function createAgentIdentity({ role, department, projectAnalysis }) {
  const now = Date.now()

  return {
    role,
    department,
    agentName: `studio-${department}-${role}`,
    instanceId: `${role}-${department}-${formatDate(now)}`,
    name: generateRoleName(role, department),  // "Tech CEO"
    personality: generatePersonality(role, department, projectAnalysis),
    managementStyle: generateManagementStyle(role),
    specialization: projectAnalysis?.stack || 'general',
    skills: generateInitialSkills(role, department, projectAnalysis),
    decisions: [],
    performance: {
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
    },
    iteration: 0,
    createdAt: now,
    lastDecisionAt: now,
    version: 1,
    status: 'active',
  }
}
```

### 2. Instanciation (à chaque décision)

```javascript
// delegation.js
async function instantiateAgent(task, identity, organization) {
  // Incrémente le compteur d'itérations
  identity.iteration++

  // Construit le prompt avec le contexte complet
  const prompt = buildAgentPrompt({
    task,
    identity,        // nom, compétences, historique, style, performance
    organization,    // structure de l'org, contexte du projet
  })

  // Crée la session via ExecutionProvider
  const handle = await executionProvider.executeTask({
    agent: identity.agentName,
    prompt,
    workspaceDirectory: organization.workspaceDirectory,
    metadata: {
      studioTaskId: task.id,
      studioAgentInstance: identity.instanceId,
      studioIteration: identity.iteration,
    },
  })

  return handle
}
```

### 3. Enregistrement de la Décision

```javascript
// identity/history.js
async function recordDecision(identity, task, response, tokenUsage) {
  const outcome = determineOutcome(response, task)
  const confidence = extractConfidence(response) // parsed from CEO JSON
  const cost = estimateCost(tokenUsage)

  const decision = {
    taskId: task.id,
    timestamp: Date.now(),
    summary: response.summary || task.title,
    outcome,
    confidence,
    tokensUsed: tokenUsage.totalTokens,
    cost,
  }

  // Append-only
  identity.decisions.push(decision)
  identity.lastDecisionAt = Date.now()

  // Met à jour les performances
  identity.performance.tasksCompleted++
  if (outcome !== 'success') identity.performance.tasksFailed++
  identity.performance.successRate =
    identity.performance.tasksCompleted /
    (identity.performance.tasksCompleted + identity.performance.tasksFailed)
  identity.performance.avgConfidence =
    movingAverage(identity.performance.avgConfidence, confidence, 0.9)
  identity.performance.avgTokens =
    movingAverage(identity.performance.avgTokens, tokenUsage.totalTokens, 0.9)
  identity.performance.avgCost =
    movingAverage(identity.performance.avgCost, cost, 0.9)
  identity.performance.totalCost += cost

  // Évolution
  updateExperienceLevel(identity)
  updatePromotionScore(identity)
  updateSkills(identity, task, outcome)

  // Sauvegarde
  await persistence.saveIdentity(identity)

  return decision
}
```

### 4. Évolution des Compétences

```javascript
// identity/evolution.js
function updateSkills(identity, task, outcome) {
  // Déduit les compétences utilisées par la tâche
  const requiredSkills = extractRequiredSkills(task)

  for (const skillName of requiredSkills) {
    const skill = identity.skills.find(s => s.name === skillName)
    if (skill) {
      // Si succès → monte en confiance
      // Si échec → descend en confiance
      skill.confidence = outcome === 'success'
        ? Math.min(1, skill.confidence + 0.05)
        : Math.max(0, skill.confidence - 0.1)
      skill.lastUsed = Date.now()

      // Level up si confiance suffisante
      if (skill.confidence > 0.9 && skill.level === 'expert') skill.level = 'master'
      else if (skill.confidence > 0.8 && skill.level === 'advanced') skill.level = 'expert'
      else if (skill.confidence > 0.6 && skill.level === 'intermediate') skill.level = 'advanced'
      else if (skill.confidence > 0.4 && skill.level === 'beginner') skill.level = 'intermediate'
    } else {
      // Nouvelle compétence détectée
      identity.skills.push({
        name: skillName,
        level: 'beginner',
        lastUsed: Date.now(),
        confidence: 0.5,
      })
    }
  }
}

function updatePromotionScore(identity) {
  const { tasksCompleted, tasksFailed, avgConfidence, totalCost } = identity.performance
  const total = tasksCompleted + tasksFailed
  if (total === 0) { identity.performance.promotionScore = 0; return }

  // Score composite
  const successWeight = 0.4
  const volumeWeight = 0.25
  const confidenceWeight = 0.2
  const efficiencyWeight = 0.15  // basé sur le coût moyen

  const successScore = (tasksCompleted / total) * 100
  const volumeScore = Math.min(100, (total / 50) * 100)  // 50 décisions = 100%
  const confidenceScore = avgConfidence * 100
  const efficiencyScore = Math.max(0, 100 - (totalCost / Math.max(1, total) / 10))

  identity.performance.promotionScore = Math.round(
    successScore * successWeight +
    volumeScore * volumeWeight +
    confidenceScore * confidenceWeight +
    efficiencyScore * efficiencyWeight
  )
}

function updateExperienceLevel(identity) {
  const { tasksCompleted, promotionScore } = identity.performance
  if (tasksCompleted >= 1000 && promotionScore > 80) identity.performance.experienceLevel = 'executive'
  else if (tasksCompleted >= 500) identity.performance.experienceLevel = 'lead'
  else if (tasksCompleted >= 100) identity.performance.experienceLevel = 'senior'
  else if (tasksCompleted >= 20) identity.performance.experienceLevel = 'mid'
  else identity.performance.experienceLevel = 'junior'
}
```

## Personnalité et Style de Management

Générés à la création de l'identité et persistés. Ils influencent le prompt des CEOs.

```javascript
function generatePersonality(role, department, projectAnalysis) {
  const personalities = {
    'global-ceo': [
      'Strategic, visionary, decisive',
      'Big-picture thinker, delegative, patient',
      'Results-driven, systematic, clear communicator',
    ],
    'tech-ceo': [
      'Analytical, pragmatic, detail-oriented',
      'Architecture-first, quality-obsessed, systematic',
      'Innovative, hands-on, solution-focused',
    ],
    'design-ceo': [
      'User-centric, creative, aesthetic',
      'Empathetic, iterative, detail-oriented',
    ],
    'worker': [
      'Focused, methodical, reliable',
      'Efficient, autonomous, practical',
    ],
  }

  const options = personalities[role] || ['Professional, focused, reliable']
  return options[hashCode(department + projectAnalysis?.stack || '') % options.length]
}

function generateManagementStyle(role) {
  const styles = {
    'global-ceo': 'Goal-oriented, high-trust, outcome-focused',
    'dept-ceo': 'Clear objectives, regular checkpoints, empowering',
    'worker': 'Self-directed, proactive, communicative',
    default: 'Professional, collaborative, efficient',
  }
  return styles[role] || styles.default
}
```

## Exemple de Prompt CEO avec Identité

```markdown
You are the Tech CEO of a software development organization.

YOUR IDENTITY:
- Name: Tech CEO
- Personality: Analytical, pragmatic, detail-oriented
- Management Style: Clear objectives, regular checkpoints, empowering
- Specialization: Full-stack web development
- Experience Level: Senior (247 decisions made)
- Success Rate: 94%

YOUR SKILLS:
- typescript: expert (confidence: 0.92)
- react: advanced (confidence: 0.85)
- next.js: advanced (confidence: 0.88)
- postgresql: intermediate (confidence: 0.72)

YOUR RECENT DECISIONS:
- [success] "Setup project structure" → 45 min, $0.23
- [success] "Design database schema" → 12 min, $0.08
- [failure] "Choose state management" → rolled back (wrong choice for scale)

YOUR TASK:
Design and delegate the implementation of a user authentication system.

ORGANIZATION CONTEXT:
- Project: E-commerce platform
- Stack: Next.js + Prisma + PostgreSQL
- Available workers: 2
- Deadline: 2 hours
```

## Stockage

```javascript
// identity/identity.js
const IDENTITY_DIR = 'studio/identities'

async function saveIdentity(identity) {
  const filePath = path.join(IDENTITY_DIR, `${identity.instanceId}.json`)
  await atomicWrite(filePath, JSON.stringify(identity, null, 2))
}

async function loadIdentity(instanceId) {
  const filePath = path.join(IDENTITY_DIR, `${instanceId}.json`)
  if (!fs.existsSync(filePath)) return null
  const data = await fs.promises.readFile(filePath, 'utf-8')
  return JSON.parse(data)
}

async function listIdentities() {
  const dir = path.join(IDENTITY_DIR)
  if (!fs.existsSync(dir)) return []
  const files = await fs.promises.readdir(dir)
  const identities = await Promise.all(
    files
      .filter(f => f.endsWith('.json'))
      .map(f => loadIdentity(f.replace('.json', '')))
  )
  return identities.filter(Boolean)
}
```

## Résumé des Règles

1. **Éphéméralité stricte** : Pas de processus entre deux décisions. Zéro exception.
2. **Identité sur disque** : Tout ce qui définit un agent est persisté. Pertes = crash toléré.
3. **Historique append-only** : Les décisions ne sont jamais modifiées, seulement ajoutées.
4. **Compétences évolutives** : Chaque tâche fait monter ou descendre les compétences concernées.
5. **Performance mesurable** : promotionScore donne un indicateur objectif pour les promotions.
6. **Pas d'humanisation forcée** : La personnalité et le style existent pour la cohérence des décisions, pas pour le rôle-play.
