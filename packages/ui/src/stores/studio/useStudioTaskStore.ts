// StudioOS — Zustand store for tasks

import { create } from 'zustand'
import type { Task, LiveActivity } from '../../lib/studio/types'

interface TaskState {
  tasks: Task[]
  activities: LiveActivity[]
  selectedTaskId: string | null
  isLoading: boolean
  error: string | null
}

interface TaskActions {
  setTasks: (tasks: Task[]) => void
  upsertTask: (task: Task) => void
  updateTaskStatus: (taskId: string, status: string, updates?: Partial<Task>) => void
  setSelectedTask: (taskId: string | null) => void
  addActivity: (activity: LiveActivity) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

const MAX_ACTIVITIES = 200

const initialState: TaskState = {
  tasks: [],
  activities: [],
  selectedTaskId: null,
  isLoading: false,
  error: null,
}

export const useStudioTaskStore = create<TaskState & TaskActions>()((set) => ({
  ...initialState,

  setTasks: (tasks) => set({ tasks, error: null }),

  upsertTask: (task) =>
    set((state) => {
      const idx = state.tasks.findIndex((t) => t.id === task.id)
      if (idx >= 0) {
        const tasks = [...state.tasks]
        tasks[idx] = { ...tasks[idx], ...task }
        return { tasks }
      }
      return { tasks: [...state.tasks, task] }
    }),

  updateTaskStatus: (taskId, status, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, status: status as Task['status'], ...updates } : t
      ),
    })),

  setSelectedTask: (taskId) => set({ selectedTaskId: taskId }),

  addActivity: (activity) =>
    set((state) => {
      const activities = [activity, ...state.activities]
      if (activities.length > MAX_ACTIVITIES) {
        activities.length = MAX_ACTIVITIES
      }
      return { activities }
    }),

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}))

// Selectors
export function getTaskTree(tasks: Task[]): TaskTreeNode[] {
  const roots = tasks.filter((t) => !t.parentId)
  return roots.map((r) => buildTreeNode(r, tasks))
}

interface TaskTreeNode {
  task: Task
  children: TaskTreeNode[]
}

function buildTreeNode(task: Task, allTasks: Task[]): TaskTreeNode {
  return {
    task,
    children: allTasks
      .filter((t) => t.parentId === task.id)
      .map((t) => buildTreeNode(t, allTasks)),
  }
}

export function getActiveTaskCount(tasks: Task[]): number {
  return tasks.filter(
    (t) => t.status === 'in_progress' || t.status === 'decomposing'
  ).length
}
