// StudioOS — API client for /api/studio/* endpoints

import { runtimeFetch } from '@/lib/runtime-fetch'

const BASE = '/api/studio/projects'

interface ApiResponse<T> {
  data?: T
  error?: string
}

async function request<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const response = await runtimeFetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      return { error: body.error || `HTTP ${response.status}` }
    }
    if (response.status === 204) return { data: undefined as T }
    const data = await response.json()
    return { data }
  } catch (err) {
    return { error: (err as Error).message || 'Network error' }
  }
}

// ─── Projects ───

export async function createProject(projectId: string, workspaceDirectory: string, name?: string) {
  return request(`/api/studio/projects`, {
    method: 'POST',
    body: JSON.stringify({ projectId, workspaceDirectory, name }),
  })
}

// ─── Organization ───

export async function getOrganization(projectId: string) {
  return request(`${BASE}/${projectId}/organization`)
}

export async function updateOrganization(projectId: string, updates: Record<string, unknown>) {
  return request(`${BASE}/${projectId}/organization`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  })
}

export async function deleteProject(projectId: string) {
  return request(`${BASE}/${projectId}`, { method: 'DELETE' })
}

// ─── Tasks ───

export async function submitTask(projectId: string, prompt: string, priority?: string) {
  return request(`${BASE}/${projectId}/tasks`, {
    method: 'POST',
    body: JSON.stringify({ prompt, priority }),
  })
}

export async function listTasks(projectId: string) {
  return request(`${BASE}/${projectId}/tasks`)
}

export async function getTask(projectId: string, taskId: string) {
  return request(`${BASE}/${projectId}/tasks/${taskId}`)
}

export async function cancelTask(projectId: string, taskId: string) {
  return request(`${BASE}/${projectId}/tasks/${taskId}/cancel`, { method: 'POST' })
}

// ─── Identities ───

export async function listIdentities(projectId: string) {
  return request(`${BASE}/${projectId}/identities`)
}

export async function getIdentity(projectId: string, instanceId: string) {
  return request(`${BASE}/${projectId}/identities/${instanceId}`)
}

// ─── Status ───

export async function getProjectStatus(projectId: string) {
  return request(`${BASE}/${projectId}/status`)
}

// ─── Live Stream (SSE) ───

export function createLiveStream(projectId: string, onEvent: (event: { type: string; data: unknown }) => void): () => void {
  const url = `${BASE}/${projectId}/live`
  const source = new EventSource(url)

  source.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data)
      onEvent({ type: 'message', data })
    } catch {}
  })

  // Listen for all studio.* events
  const handler = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)
      onEvent({ type: event.type, data })
    } catch {}
  }

  // The server sends events like "studio.task.created", "studio.task.completed"
  // We use the generic message handler plus the wildcard event listener
  source.onmessage = handler

  return () => {
    source.close()
  }
}
