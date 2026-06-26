// StudioOS — Zustand store for mode switching and project management

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { StudioMode, StudioProjectSummary, OrganizationStatus } from '../../lib/studio/types'

interface StudioState {
  mode: StudioMode
  activeProjectId: string | null
  projects: StudioProjectSummary[]
  isOnboarding: boolean
  isInitialized: boolean
}

interface StudioActions {
  switchMode: (mode: StudioMode) => void
  setActiveProject: (projectId: string | null) => void
  addProject: (project: StudioProjectSummary) => void
  removeProject: (projectId: string) => void
  updateProjectStatus: (projectId: string, status: OrganizationStatus) => void
  setOnboarding: (value: boolean) => void
  setInitialized: (value: boolean) => void
  reset: () => void
}

const initialState: StudioState = {
  mode: 'openchamber',
  activeProjectId: null,
  projects: [],
  isOnboarding: false,
  isInitialized: false,
}

export const useStudioStore = create<StudioState & StudioActions>()(
  persist(
    (set) => ({
      ...initialState,

      switchMode: (mode) => set({ mode }),

      setActiveProject: (projectId) => set({ activeProjectId: projectId }),

      addProject: (project) =>
        set((state) => ({
          projects: [...state.projects.filter((p) => p.id !== project.id), project],
        })),

      removeProject: (projectId) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== projectId),
          activeProjectId:
            state.activeProjectId === projectId ? null : state.activeProjectId,
        })),

      updateProjectStatus: (projectId, status) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, status } : p
          ),
        })),

      setOnboarding: (value) => set({ isOnboarding: value }),

      setInitialized: (value) => set({ isInitialized: value }),

      reset: () => set(initialState),
    }),
    {
      name: 'studio-store',
      partialize: (state) => ({
        mode: state.mode,
        activeProjectId: state.activeProjectId,
        projects: state.projects,
      }),
    }
  )
)
