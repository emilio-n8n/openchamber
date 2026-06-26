# Glossaire StudioOS

Termes et concepts clés du projet.

## A

**Agent** — Définition d'un assistant IA dans OpenCode (fichier `.md` avec YAML frontmatter). Un agent a un mode (`primary`, `subagent`, `all`), un modèle, des permissions, un prompt. Les agents StudioOS (comme `studio-global-ceo`) sont des agents OpenCode standards.

**Agent Identity** — Représentation persistante d'un agent StudioOS : nom, compétences, historique des décisions, métriques de performance. L'identité est stockée sur disque et survit aux sessions LLM. Voir `AGENT-IDENTITY.md`.

**Agent Instance** — Exécution réelle d'un agent (session OpenCode). Créée à la demande pour une décision, détruite après. Éphémère par conception.

**Agent Role** — Fonction dans l'organisation : `global-ceo`, `dept-ceo`, `worker`, `recruiter`, etc. Les rôles sont persistants, les instances sont éphémères.

## C

**Circuit Breaker** — Mécanisme du Supervisor qui bloque les nouvelles tâches assignées à un agent après 3 échecs consécutifs. Réinitialisation automatique après 30 minutes.

## D

**DAG (Directed Acyclic Graph)** — Représentation des dépendances entre tâches. Tâche B dépend de A → A doit être terminée avant que B commence.

**Decision Record** — Enregistrement append-only d'une décision prise par un agent. Inclut : la tâche, le résultat, la confiance, le coût en tokens. Stocké dans l'`AgentIdentity`.

**Department** — Unité organisationnelle (Tech, Design, QA, Product). Possède un CEO, des objectifs, des workers. Objet de première classe dans StudioOS.

## E

**Event Bus** — Système de distribution d'événements interne à StudioOS. Permet le découplage entre l'orchestrateur, le scheduler, le supervisor, et les autres composants.

**Éphéméralité (Agent)** — Principe fondamental : les agents n'existent pas en tant que processus entre deux décisions. L'identité est sauvegardée, la session LLM est créée à la demande et détruite après la décision.

**ExecutionProvider** — Interface d'abstraction entre StudioOS et le moteur d'exécution (OpenCode aujourd'hui, Codex/Claude Code demain). Permet de changer de moteur sans modifier le runtime StudioOS.

**Experience Level** — Niveau d'un agent basé sur le nombre de décisions : junior (<20), mid (21-100), senior (101-500), lead (501+), executive (1000+ + taux succès >90%).

## G

**Global CEO** — Agent racine de l'organisation. Reçoit les tâches utilisateur, les décompose en objectifs département. Premier agent instancié dans toute organisation.

**Governance Agent** — Agent permanent de la structure organisationnelle (CEOs, Directors). S'oppose aux agents dynamiques (workers créés par le Recruiter).

## I

**Identité** — Voir Agent Identity.

**Itération** — Nombre de fois qu'un agent a été instancié (session OpenCode créée puis détruite). Mesure de l'expérience.

## L

**Live Dashboard** — Vue temps réel de l'organisation en action. Montre la chaîne de délégation, l'activité des workers, les décisions, les coûts.

## M

**Mode Switcher** — Sélecteur OpenChamber / StudioOS dans l'interface. Permet de basculer entre le mode classique et le mode organisation sans perte de state.

## O

**OpenChamber (mode classique)** — Comportement actuel d'OpenChamber : chat, agents, terminal, git. Inchangé par StudioOS.

**Organization** — Structure hiérarchique complète d'un projet StudioOS : départements, agents, tâches. Générée automatiquement à la création du projet.

**Organization Runtime** — Sous-système de StudioOS composé de l'event-bus, state-machine, scheduler, task-queue, et supervisor. Gère la vie de l'organisation.

**Orchestrator** — Module qui exécute le flow CEO → Department → Worker. Crée les sessions, parse les réponses, coordonne la délégation.

## P

**Performance Metrics** — Métriques de chaque agent : tâches complétées, taux de succès, confiance moyenne, coût moyen, score de promotion.

**Persistence** — Module de sauvegarde atomique (temp + rename) de l'état StudioOS sur disque. Par projet, dans `~/.config/openchamber/studio/<projectId>/`.

**Promotion Score** — Score composite (0-100) calculé à partir du taux de succès (40%), du volume de décisions (25%), de la confiance moyenne (20%), et de l'efficacité (15%). Détermine l'éligibilité à une promotion.

## R

**Recruiter** — Agent spécialisé (V3+) qui analyse les compétences requises par une tâche et crée dynamiquement des agents worker spécialisés.

**Runtime** — Voir Organization Runtime.

## S

**Scheduler** — Composant du Runtime qui gère les actions différées : timeouts, retry backoff, réveil d'agents.

**Session (OpenCode)** — Unité d'exécution. Chaque décision d'agent = une session OpenCode. Les sessions sont créées par `promptAsync` et streamées via SSE.

**Skill** — Compétence d'un agent (TypeScript, React, PostgreSQL). Niveau : beginner → intermediate → advanced → expert → master. Évolue avec les décisions.

**State Machine** — Composant du Runtime qui valide les transitions d'état des tâches et des agents. Empêche les transitions invalides.

**StudioOS** — Couche d'intelligence organisationnelle au-dessus d'OpenChamber. Operating System for AI Organizations.

**Supervisor** — Composant du Runtime qui surveille la santé de l'organisation : timeouts, circuit breakers, échecs en cascade.

## T

**Task** — Unité de travail dans StudioOS. Trois types :
- `root` : tâche utilisateur racine
- `department` : objectif décomposé par le Global CEO
- `worker` : tâche d'exécution décomposée par un Department CEO

**Task Queue** — File d'attente prioritaire des tâches worker. Limite la concurrence (max 3 workers simultanés en V1). Gère la priorité (critical > high > normal > low).

**Template (Agent)** — Prompt pré-défini pour un rôle de gouvernance. Stocké dans `lib/studio/agents/templates/`. Utilisé à la création de l'organisation.

## W

**Worker** — Agent d'exécution. Reçoit des tâches concrètes d'un Department CEO et les exécute via les outils OpenCode (read, write, edit, bash, git).

**Worktree** — Checkout git isolé par worker. Permet à plusieurs workers de modifier le code en parallèle sans conflit. Utilise le système de worktrees existant d'OpenChamber.

## Z

**Zod** — Librairie de validation de schémas utilisée pour valider les réponses JSON des CEOs et les données persistées.
