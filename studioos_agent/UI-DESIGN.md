# UI Design — StudioOS

Ce document décrit les interfaces utilisateur du mode StudioOS. Toutes les vues suivent les patterns existants d'OpenChamber : `MainTab`, `MainLayout`, composants React avec Zustand et Tailwind v4.

## 1. Mode Switcher

### Header — Sélecteur de mode

Ajouté dans `Header.tsx` à côté du tab strip existant :

```
┌──────────────────────────────────────────────────────────────┐
│  ◉ OpenChamber  ○ StudioOS     │  [+]  [model]  [agent]  ⚙️ │
│  ┌──┬──┬──┬──┬──┬──┬──┐                                      │
│  │CH│PL│GI│DI│TE│FI│DG│                                      │
│  └──┴──┴──┴──┴──┴──┴──┘                                      │
└──────────────────────────────────────────────────────────────┘

           ↓ quand mode StudioOS est sélectionné

┌──────────────────────────────────────────────────────────────┐
│  ○ OpenChamber  ◉ StudioOS     │  Projet: MonSite 🟢       │
│  ┌────────┬──────┬──────┬──────┐                              │
│  │ 📊 Org │ 📋 Tâches │ 👁 Live │ 💬 Chat │                 │
│  └────────┴──────┴──────┴──────┘                              │
└──────────────────────────────────────────────────────────────┘
```

### Comportement

- Le mode est persistant (localStorage)
- Le switch est immédiat (pas de reload)
- Le mode classique est restauré sans perte de state (chat view toujours montée)
- En mode StudioOS : le tab strip classique est remplacé par les tabs Studio
- Le bouton Chat existe toujours dans StudioOS (accès au chat classique si besoin)

## 2. Vue Organisation (OrganizationView)

### Arbre interactif

```
┌─────────────────────────────────────────────────────────────┐
│  Organisation ── Projet: MonSite                    [✎] [✚] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  🏢 Global CEO                                        🟢    │
│  │   Décisions: 12 · Succès: 92% · Itération: 5            │
│  │                                                          │
│  ├── 💻 Tech CEO                                       🟢   │
│  │   │   Décisions: 8 · Succès: 88% · Skills: TS, React   │
│  │   │                                                      │
│  │   └── 👷 Worker 1                                   🟢   │
│  │       👷 Worker 2                                   💤   │
│  │                                                          │
│  └── 🎨 Design CEO                                     💤   │
│      │   Décisions: 3 · Succès: 100% · Skills: UI, Figma  │
│      │                                                      │
│      └── 👷 Worker 3                                   💤   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Interactions

| Action | Comportement |
|---|---|
| Clic sur un nœud | Ouvre le panneau de détail (slide-in right panel) |
| ✚ (ajouter département) | Menu : "Tech" / "Design" / "QA" / "Product" |
| ✎ (éditer nom) | Inline rename |
| Drag & drop | Réorganiser les départements (V2+, réutiliser `@dnd-kit`) |
| Statut 🟢🟡🔴💤 | Agent en cours / en attente / erreur / idle |

### Panneau de détail (slide-in)

```
┌──────────────────────────────────────────────┐
│  ← Retour                     Tech CEO        │
├──────────────────────────────────────────────┤
│                                              │
│  🟢 En ligne                                 │
│                                              │
│  ── Identité ──                              │
│  Personnalité: Analytical, pragmatic         │
│  Style: Goal-oriented, empowering            │
│  Spécialisation: Full-stack web dev          │
│                                              │
│  ── Compétences ──                           │
│  TypeScript    ██████████░  Expert           │
│  React         ████████░░  Avancé            │
│  Next.js       ████████░░  Avancé            │
│  PostgreSQL    ██████░░░░  Intermédiaire     │
│                                              │
│  ── Performance ──                           │
│  Tâches: 8/2 (succès/échec)                  │
│  Taux: 88% ████████░░                        │
│  Confiance: 85% ████████░                    │
│  Score promo: 62/100                         │
│  Niveau: Senior                              │
│                                              │
│  ── Dernières décisions ──                   │
│  ✅ Setup project structure  45min $0.23     │
│  ✅ Design DB schema         12min $0.08     │
│  ❌ Choose state mgmt        8min  $0.05     │
│                                              │
│  ── Actions ──                               │
│  [Envoyer une tâche]  [Modifier]             │
│                                              │
└──────────────────────────────────────────────┘
```

## 3. Vue Tâches (StudioTasksView)

### V1 — Liste hiérarchique

```
┌─────────────────────────────────────────────────────────────┐
│  Tâches ── Projet: MonSite                         [✚] 🎯 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ▶ 🎯 Construire un site Next.js              EN COURS 🟡   │
│  │    Créée: 12:34 · Deadine: -- · Priorité: Haute         │
│  │                                                          │
│  ├── 💻 Setup Next.js project                  TERMINÉ 🟢   │
│  │    Worker 1 · 2min 30s · $0.12                          │
│  │    ✅ npx create-next-app@latest — OK                    │
│  │    ✅ npm install — OK                                   │
│  │                                                          │
│  ├── 💻 Create API routes                     EN COURS 🟡   │
│  │    Worker 2 · 45s · $0.03                               │
│  │    🟡 Writing app/api/users/route.ts...                  │
│  │                                                          │
│  ├── 🎨 Build landing page                    EN ATTENTE 💤 │
│  │    Worker 3 (attend que Worker 2 finisse)               │
│  │                                                          │
│  └── 🎨 Design system                         EN ATTENTE 💤 │
│       Worker 4 (attend Build landing page)                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### V2 — Kanban

```
┌──────────────────────────────────────────────────────────────────┐
│  Tâches ── Projet: MonSite                            [DAG] [✚] │
├────────────┬────────────┬──────────────┬────────────┬───────────┤
│  📥 À faire │ 🔄 En cours  │ ✅ Terminé     │ ❌ Échoué   │ ⏸ Bloqué │
├────────────┼────────────┼──────────────┼────────────┼───────────┤
│            │            │              │            │           │
│  Landing   │ API routes │ Setup Next   │            │           │
│  page      │ Worker 2   │ Worker 1     │            │           │
│            │ 🟡 45s     │ 🟢 2m30s     │            │           │
│            │            │              │            │           │
│  Design    │            │              │            │           │
│  system    │            │              │            │           │
│            │            │              │            │           │
│            │            │              │            │           │
└────────────┴────────────┴──────────────┴────────────┴───────────┘
```

### V2 — DAG (graphe de dépendances)

```
┌──────────────────────────────────────────────────────────────────┐
│  Dépendances ── Projet: MonSite                    [Kanban] [✚] │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│         ┌──────────────────┐                                      │
│         │  Setup Next.js   │  ← Worker 1 (✅ terminé)             │
│         └────────┬─────────┘                                      │
│                  │                                                │
│          ┌───────┴────────┐                                       │
│          ▼                ▼                                       │
│  ┌──────────────┐  ┌──────────────┐                               │
│  │ API routes   │  │ Auth system   │   ← Worker 2, Worker 3       │
│  │ Worker 2 🟡  │  │ Worker 3 💤   │      (peuvent être parallèles)│
│  └──────┬───────┘  └───────┬──────┘                               │
│         │                  │                                       │
│         └────────┬─────────┘                                       │
│                  ▼                                                 │
│         ┌──────────────────┐                                      │
│         │   Landing page   │  ← Worker 4 (⚡ dépend de API + Auth)│
│         │   Worker 4 💤    │                                       │
│         └──────────────────┘                                      │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

## 4. Vue Live (StudioLiveView)

### V1 — Salle de contrôle

```
┌─────────────────────────────────────────────────────────────┐
│  Live ── Projet: MonSite                                  ⏱️ │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌── STATUT ────────────────────────────────────────────┐   │
│  │  🟢 Projet actif · 5 agents · 3 tâches en cours     │   │
│  │  Temps écoulé: 3min 45s · Coût estimé: $0.47       │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌── CHAÎNE DE DÉLÉGATION ─────────────────────────────┐   │
│  │                                                      │   │
│  │  🟢 Global CEO ──→ 🟢 Tech CEO ──→ 🟡 Worker 2      │   │
│  │                              └──→ 🟢 Worker 1 ✓      │   │
│  │                 └──→ 💤 Design CEO ──→ 💤 Worker 3   │   │
│  │                                                      │   │
│  │  (les nœuds sont cliquables → focus dans la vue Org) │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌── ACTIVITÉ RÉCENTE ──────────────────────────────────┐   │
│  │                                                      │   │
│  │  12:34:22  🟡 Tech CEO      decomposing task...      │   │
│  │  12:34:50  🟢 Global CEO    task decomposed          │   │
│  │            └─→ 2 departments créés                   │   │
│  │  12:35:10  🟢 Tech CEO      created 2 worker tasks  │   │
│  │  12:35:15  🟢 Worker 1      started: Setup Next.js  │   │
│  │  12:35:16  🟡 Worker 1      running npm create...   │   │
│  │  12:37:42  🟢 Worker 1      ✅ Setup Next.js ✓      │   │
│  │  12:37:43  🟢 Tech CEO      ⏭ Worker 2: API routes  │   │
│  │  12:37:45  🟡 Worker 2      started: API routes     │   │
│  │  12:37:46  🟡 Worker 2      writing route.ts...     │   │
│  │            ...                                       │   │
│  │                                                      │   │
│  │  [🔽 Dernières activités]                    [📋 Logs]│   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌── AGENTS ACTIFS ─────────────────────────────────────┐   │
│  │                                                      │   │
│  │  Worker 2    🟡 APIs         45s · $0.03 🔄         │   │
│  │  └─ bash: cat package.json                           │   │
│  │                                                      │   │
│  │  Worker 1    🟢 Terminé      2m30s · $0.12 ✅       │   │
│  │                                                      │   │
│  │  Worker 3    💤 En attente   --    · --              │   │
│  │  (attend: API routes)                                │   │
│  │                                                      │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Animation des transitions

Chaque événement `studio.*` reçu par SSE déclenche :
1. Ajout d'une ligne dans l'activité récente (avec animation fade-in)
2. Mise à jour de la chaîne de délégation (couleur, statut)
3. Mise à jour du statut des agents (dans la colonne de droite)
4. Notification toast pour les événements importants (task completed, task failed)

La vue Live est conçue pour être laissée ouverte en permanence, comme une salle de contrôle.

## 5. Onboarding (StudioOnboarding)

### Étape 1 — Sélection du projet

```
┌─────────────────────────────────────────────────────────┐
│  Bienvenue dans StudioOS                       Skip ✕   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  StudioOS transforme votre projet en organisation       │
│  d'agents IA. Choisissez un projet pour commencer.      │
│                                                          │
│  ┌─────────────────────────────────────┐                │
│  │  Projet actuel : MonSite            │                │
│  │  📁 /Users/me/projects/monsite      │                │
│  │                                     │                │
│  │  [Changer de projet]  [Nouveau]     │                │
│  └─────────────────────────────────────┘                │
│                                                          │
│  [Continuer →]                                           │
└─────────────────────────────────────────────────────────┘
```

### Étape 3 — Génération de l'organisation

```
┌─────────────────────────────────────────────────────────┐
│  Organisation générée                         ← Retour   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Projet détecté : Next.js                                │
│                                                          │
│  Organisation proposée :                                 │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐│
│  │  🏢 Global CEO                                       ││
│  │  ├── 💻 Tech CEO                                     ││
│  │  │   └── 👷 2 workers                                ││
│  │  └── 🎨 Design CEO                                   ││
│  │       └── 👷 1 worker                                ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
│  [✚ Ajouter un département]                             │
│                                                          │
│  [← Modifier]                    [Confirmer →]           │
└─────────────────────────────────────────────────────────┘
```

### Étape 5 — Première tâche

```
┌─────────────────────────────────────────────────────────┐
│  StudioOS est prêt !                          Félicitations │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Votre organisation est créée.                          │
│                                                          │
│  4 agents · 3 workers · 0 tâches en cours               │
│                                                          │
│  Que voulez-vous construire ?                            │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐│
│  │ 🔍 "Construis un site Next.js..."                    ││
│  │                                                     ││
│  │  [Exemples : "Ajoute une page de connexion"         ││
│  │   "Crée une API REST" "Déploie sur Vercel"]         ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
│  [Aller au dashboard]                                    │
└─────────────────────────────────────────────────────────┘
```

## 6. Organisation des Fichiers UI

```
packages/ui/src/
├── components/
│   ├── views/
│   │   ├── StudioView.tsx          ← Router interne StudioOS
│   │   ├── OrganizationView.tsx     ← Arbre organisationnel
│   │   ├── StudioTasksView.tsx      ← Liste/Kanban/DAG
│   │   └── StudioLiveView.tsx       ← Salle de contrôle
│   │
│   └── studio/                      ← Composants StudioOS
│       ├── StudioSidebar.tsx        ← Projets Studio
│       ├── StudioHeader.tsx         ← Navigation interne Studio
│       ├── StudioOnboarding.tsx     ← Création projet + onboarding
│       ├── OrgTree.tsx              ← Arbre récursif
│       ├── OrgNode.tsx              ← Nœud (agent/département)
│       ├── OrgDetailPanel.tsx       ← Panneau de détail
│       ├── TaskList.tsx             ← Liste hiérarchique V1
│       ├── TaskKanban.tsx           ← Kanban V2
│       ├── TaskDAG.tsx              ← Graphe DAG V2
│       ├── TaskCard.tsx             ← Carte tâche
│       ├── LiveActivityFeed.tsx     ← Flux d'activité
│       ├── LiveDelegationChain.tsx  ← Chaîne de délégation
│       ├── LiveAgentStatus.tsx      ← Statut des agents
│       └── ModeSwitcher.tsx         ← Bascule Classic/Studio
│
├── stores/
│   ├── useStudioStore.ts           ← Mode, projets
│   ├── useOrganizationStore.ts     ← Org, départements
│   └── useStudioTaskStore.ts       ← Tâches
│
└── sync/
    └── studio-sync.ts              ← Handler events studio.*
```

## 7. Principes UI

1. **Utiliser les primitives existantes** — `@base-ui/react`, `sonner` toast, `theme` tokens, `Icon` component
2. **Pas de nouvelle librairie UI en V1** — tout est construit avec les composants existants
3. **Pas de graphe externe en V1** — l'arbre organisationnel est du CSS + `@base-ui/react/collapsible`
4. **Responsive design** — les vues Studio s'adaptent à la sidebar droite automatiquement
5. **Thème dark/light** — les couleurs suivent les tokens thème existants
6. **Même charte graphique** — polices IBM Plex, remixicon, couleurs thème
7. **Performances** — les vues Studio sont lazy-loaded avec `lazyWithChunkRecovery`
