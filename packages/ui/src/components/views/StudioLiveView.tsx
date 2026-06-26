// StudioOS — Live activity dashboard (real-time)

import { useRef, useEffect } from 'react'
import { useStudioTaskStore } from '@/stores/studio/useStudioTaskStore'
import { useOrganizationStore } from '@/stores/studio/useOrganizationStore'
import type { LiveActivity } from '@/lib/studio/types'

export function StudioLiveView() {
  const activities = useStudioTaskStore((s) => s.activities)
  const tasks = useStudioTaskStore((s) => s.tasks)
  const organization = useOrganizationStore((s) => s.organization)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to top for new activities
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [activities.length])

  const activeTasks = tasks.filter(
    (t) => t.status === 'in_progress' || t.status === 'decomposing'
  )
  const completedTasks = tasks.filter((t) => t.status === 'completed')
  const failedTasks = tasks.filter((t) => t.status === 'failed')

  return (
    <div className="h-full flex">
      {/* Activity Feed */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-1">
        {activities.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center space-y-2">
              <p className="text-lg">👁</p>
              <p className="text-[--text-secondary]">
                Waiting for organization activity...
              </p>
              <p className="text-sm text-[--text-tertiary]">
                Submit a task to see real-time activity here.
              </p>
            </div>
          </div>
        )}

        {activities.map((activity, i) => (
          <ActivityRow key={`${activity.timestamp}-${i}`} activity={activity} />
        ))}
      </div>

      {/* Sidebar stats */}
      <div className="w-64 border-l border-[--border] p-4 space-y-4">
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-[--text-primary]">Status</h3>
          <Stat label="Active" value={activeTasks.length} color="text-yellow-500" />
          <Stat label="Completed" value={completedTasks.length} color="text-green-500" />
          <Stat label="Failed" value={failedTasks.length} color="text-red-500" />
        </div>

        {organization && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-[--text-primary]">Organization</h3>
            <Stat
              label="Departments"
              value={organization.structure.departments.length}
            />
            <Stat
              label="Agents"
              value={organization.structure.governanceAgents.length}
            />
          </div>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-[--text-primary]">Recent Activity</h3>
          <p className="text-xs text-[--text-tertiary]">
            {activities.length > 0
              ? `Last event: ${formatTime(activities[0].timestamp)}`
              : 'No events yet'}
          </p>
        </div>
      </div>
    </div>
  )
}

function ActivityRow({ activity }: { activity: LiveActivity }) {
  const eventName = (activity.type || '').replace('studio.', '')

  const iconMap: Record<string, string> = {
    task_created: '📝',
    task_decomposing: '🔄',
    task_decomposed: '📋',
    task_assigned: '📌',
    task_started: '▶️',
    task_activity: '⚡',
    task_completed: '✅',
    task_failed: '❌',
    task_cancelled: '🚫',
    agent_state_changed: '🔄',
    identity_evolved: '📈',
  }

  const statusColors: Record<string, string> = {
    task_completed: 'text-green-500',
    task_failed: 'text-red-500',
    task_started: 'text-yellow-500',
    task_decomposing: 'text-blue-500',
  }

  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="text-sm mt-0.5">
        {iconMap[eventName] || '📄'}
      </span>
      <div className="flex-1 min-w-0">
        <span
          className={`text-sm ${statusColors[eventName] || 'text-[--text-primary]'}`}
        >
          {formatActivityMessage(activity, eventName)}
        </span>
        <span className="text-xs text-[--text-tertiary] ml-2">
          {formatTime(activity.timestamp)}
        </span>
      </div>
    </div>
  )
}

function formatActivityMessage(activity: LiveActivity, eventName: string): string {
  const data = activity.data as Record<string, unknown> | undefined
  switch (eventName) {
    case 'task_created':
      return `Task created: ${(data as { task?: { title?: string } })?.task?.title || ''}`
    case 'task_decomposing':
      return `${(data as { taskId?: string })?.taskId?.slice(0, 8) || ''} is being decomposed...`
    case 'task_decomposed':
      return `Delegation complete — ${(data as { children?: unknown[] })?.children?.length || 0} sub-tasks`
    case 'task_started':
      return `Task started: ${(data as { sessionId?: string })?.sessionId?.slice(0, 8) || ''}`
    case 'task_activity':
      return `Activity: ${(data as { type?: string })?.type || 'tick'}`
    case 'task_completed':
      return 'Task completed ✓'
    case 'task_failed':
      return `Failed: ${(data as { error?: string })?.error || 'Unknown error'}`
    case 'agent_state_changed':
      return `Agent ${(data as { agentId?: string })?.agentId?.slice(0, 8) || ''} → ${(data as { state?: string })?.state || '?'}`
    default:
      return `${eventName} — ${JSON.stringify(data).slice(0, 60)}`
  }
}

function Stat({
  label,
  value,
  color,
}: {
  label: string
  value: number | string
  color?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[--text-secondary]">{label}</span>
      <span className={`text-sm font-mono font-medium ${color || 'text-[--text-primary]'}`}>
        {value}
      </span>
    </div>
  )
}

function formatTime(ts: number): string {
  const date = new Date(ts)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
