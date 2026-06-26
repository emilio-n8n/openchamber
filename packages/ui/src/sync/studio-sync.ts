// StudioOS — SSE event handler

// Maps studio.* SSE events to Zustand store updates
// Registered conditionally only when Studio mode is active

import { useOrganizationStore } from '@/stores/studio/useOrganizationStore'
import { useStudioTaskStore } from '@/stores/studio/useStudioTaskStore'

interface StudioEvent {
  type: string
  data: Record<string, unknown>
  timestamp: number
}

export function handleStudioEvent(event: StudioEvent) {
  const eventName = event.type.replace('studio.', '')

  switch (eventName) {
    case 'organization.created':
    case 'organization.updated':
      useOrganizationStore.getState().setOrganization(event.data as never)
      break

    case 'task.created':
      useStudioTaskStore.getState().upsertTask(event.data as never)
      break

    case 'task.status_changed':
      useStudioTaskStore
        .getState()
        .updateTaskStatus(
          event.data.taskId as string,
          event.data.status as string
        )
      break

    case 'task.decomposing':
    case 'task.decomposed':
    case 'task.assigned':
    case 'task.started':
    case 'task.completed':
    case 'task.failed':
    case 'task.cancelled':
      useStudioTaskStore.getState().updateTaskStatus(
        event.data.taskId as string,
        eventName === 'task.failed'
          ? 'failed'
          : eventName === 'task.completed'
            ? 'completed'
            : eventName === 'task.cancelled'
              ? 'cancelled'
              : eventName === 'task.started'
                ? 'in_progress'
                : eventName
      )
      useStudioTaskStore
        .getState()
        .addActivity({ ...event.data, type: eventName, timestamp: event.timestamp } as never)
      break

    case 'task.activity':
      useStudioTaskStore
        .getState()
        .addActivity({
          type: eventName,
          taskId: event.data.taskId as string,
          data: event.data,
          timestamp: event.timestamp,
        } as never)
      break

    case 'agent.state_changed':
      useOrganizationStore.getState().updateDepartment(
        (event.data as Record<string, string>).agentId as string,
        { status: (event.data as Record<string, string>).state as never } as never
      )
      break

    case 'identity.updated':
    case 'identity.evolved':
      useOrganizationStore.getState().updateIdentity(
        (event.data as Record<string, string>).instanceId as string,
        event.data as never
      )
      break

    default:
      // Unknown events are silently ignored (forward-compatible)
      break
  }
}
