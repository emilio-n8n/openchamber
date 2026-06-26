// StudioOS — Zustand store for organization state

import { create } from 'zustand'
import type { Organization, Department, GovernanceAgentRef, AgentIdentity } from '@/lib/studio/types'

interface OrganizationState {
  organization: Organization | null
  identities: AgentIdentity[]
  isLoading: boolean
  error: string | null
}

interface OrganizationActions {
  setOrganization: (org: Organization) => void
  updateDepartment: (deptId: string, updates: Partial<Department>) => void
  addDepartment: (dept: Department) => void
  removeDepartment: (deptId: string) => void
  setIdentities: (identities: AgentIdentity[]) => void
  updateIdentity: (instanceId: string, updates: Partial<AgentIdentity>) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

const initialState: OrganizationState = {
  organization: null,
  identities: [],
  isLoading: false,
  error: null,
}

export const useOrganizationStore = create<OrganizationState & OrganizationActions>()(
  (set) => ({
    ...initialState,

    setOrganization: (org) => set({ organization: org, error: null }),

    updateDepartment: (deptId, updates) =>
      set((state) => {
        if (!state.organization) return state
        return {
          organization: {
            ...state.organization,
            structure: {
              ...state.organization.structure,
              departments: state.organization.structure.departments.map((d) =>
                d.id === deptId ? { ...d, ...updates } : d
              ),
            },
          },
        }
      }),

    addDepartment: (dept) =>
      set((state) => {
        if (!state.organization) return state
        return {
          organization: {
            ...state.organization,
            structure: {
              ...state.organization.structure,
              departments: [...state.organization.structure.departments, dept],
            },
          },
        }
      }),

    removeDepartment: (deptId) =>
      set((state) => {
        if (!state.organization) return state
        return {
          organization: {
            ...state.organization,
            structure: {
              ...state.organization.structure,
              departments: state.organization.structure.departments.filter(
                (d) => d.id !== deptId
              ),
            },
          },
        }
      }),

    setIdentities: (identities) => set({ identities }),

    updateIdentity: (instanceId, updates) =>
      set((state) => ({
        identities: state.identities.map((i) =>
          i.instanceId === instanceId ? { ...i, ...updates } : i
        ),
      })),

    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),
    reset: () => set(initialState),
  })
)
