# StudioOS — Server Module

## Purpose

StudioOS is the organizational intelligence layer for OpenChamber. It transforms OpenChamber
from a single-chat-agent interface into an "Operating System for AI Organizations."

## Architecture

StudioOS adds four layers on top of OpenChamber:

1. **Organization Runtime** — event-bus, state-machine, scheduler, task-queue, supervisor
2. **Identity System** — persistent agent identities with skills, history, performance
3. **Orchestrator** — CEO → Department → Worker delegation flow
4. **Execution Provider** — abstraction layer over execution engines (OpenCode is the first impl)

## Module structure

```
lib/studio/
├── DOCUMENTATION.md               This file
├── index.js                       createStudioRuntime (composition root)
├── types.js                       Zod schemas + factories
├── runtime/
│   ├── event-bus.js               Internal event distribution
│   ├── state-machine.js           Valid state transitions
│   ├── scheduler.js               Delayed actions (timeouts, retry, wake-up)
│   ├── task-queue.js              Priority queue + concurrency limits
│   └── supervisor.js              Health checks + circuit breakers
├── identity/
│   ├── identity.js                AgentIdentity CRUD
│   ├── history.js                 Decision recording (append-only)
│   └── evolution.js               Performance metrics, promotions
├── execution/
│   ├── provider.js                ExecutionProvider interface
│   └── opencode-provider.js       OpenCode implementation
├── orchestrator.js                CEO→Dept→Worker delegation flow
├── delegation.js                  Prompt building + CEO response parsing
├── organization.js                Organization CRUD + persistence
├── org-generator.js               Auto-organization from project analysis
├── agent-templates.js             Governance agent template definitions
├── routes.js                      REST API /api/studio/*
├── events.js                      SSE event helpers
└── persistence.js                 Atomic disk persistence
```

## Integration

The module is registered in `feature-routes-runtime.js` as a single line:
```js
registerStudioRoutes(app, deps)
```

The runtime is created lazily when the first StudioOS project is created.

## Key principles

1. **StudioOS decides, OpenCode executes** — StudioOS never duplicates what OpenCode does
2. **Agents are ephemeral** — roles persist, processes are temporary
3. **Identity persists** — every decision builds the agent's track record
4. **ExecutionProvider abstraction** — swap OpenCode for any other engine
5. **Backward compatible** — OpenChamber classic mode is untouched
