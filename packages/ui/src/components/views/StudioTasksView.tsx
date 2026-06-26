// StudioOS — Task list view (hierarchical)

import { useStudioTaskStore, getTaskTree } from '@/stores/studio/useStudioTaskStore'
import type { Task } from '@/lib/studio/types'

export function StudioTasksView() {
  const tasks = useStudioTaskStore((s) => s.tasks)
  const isLoading = useStudioTaskStore((s) => s.isLoading)
  const tree = getTaskTree(tasks)

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-[--text-secondary]">Loading tasks...</div>
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-[--text-secondary]">No tasks yet.</p>
          <p className="text-sm text-[--text-tertiary]">
            Submit a task to the organization to see it here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-2">
        {tree.map((node) => (
          <TaskTreeNode key={node.task.id} node={node} depth={0} />
        ))}
      </div>
    </div>
  )
}

type TreeNodeChild = { task: Task; children: TreeNodeChild[] }

function TaskTreeNode({
  node,
  depth,
}: {
  node: { task: Task; children: TreeNodeChild[] }
  depth: number
}) {
  const statusColors: Record<string, string> = {
    completed: 'border-l-green-500',
    in_progress: 'border-l-yellow-500',
    decomposing: 'border-l-blue-500',
    pending: 'border-l-gray-400',
    failed: 'border-l-red-500',
    blocked: 'border-l-orange-500',
    cancelled: 'border-l-gray-300',
  }

  const statusIcons: Record<string, string> = {
    completed: '✅',
    in_progress: '🟡',
    decomposing: '🔄',
    pending: '⏳',
    failed: '❌',
    blocked: '⛔',
    cancelled: '🚫',
  }

  return (
    <div style={{ marginLeft: depth * 24 }}>
      <div
        className={`border-l-2 pl-4 py-2 ${statusColors[node.task.status] || 'border-l-gray-400'}`}
      >
        <div className="flex items-center gap-2">
          <span>{statusIcons[node.task.status] || '📄'}</span>
          <span className="font-medium text-[--text-primary]">{node.task.title}</span>
          <span className="text-xs text-[--text-tertiary]">
            {node.task.type === 'root'
              ? '🎯'
              : node.task.type === 'department'
                ? '📁'
                : '📄'}
          </span>
        </div>
        <div className="text-xs text-[--text-secondary] mt-0.5 space-x-3">
          <span>Created: {formatTime(node.task.createdAt)}</span>
          {node.task.assignedAgentId && (
            <span>Agent: {node.task.assignedAgentId}</span>
          )}
          {node.task.cost !== undefined && (
            <span>Cost: ${node.task.cost.toFixed(4)}</span>
          )}
        </div>
      </div>
      {node.children.length > 0 && (
        <div className="mt-1 space-y-1">
          {node.children.map((child) => (
            <TaskTreeNode key={child.task.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function formatTime(ts: number): string {
  const date = new Date(ts)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
