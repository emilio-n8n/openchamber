// StudioOS — Organization tree view

import { useOrganizationStore } from '../../stores/studio/useOrganizationStore'
import type { Department, GovernanceAgentRef } from '../../lib/studio/types'

export function OrganizationView() {
  const organization = useOrganizationStore((s) => s.organization)
  const identities = useOrganizationStore((s) => s.identities)
  const isLoading = useOrganizationStore((s) => s.isLoading)

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-[--text-secondary]">Loading organization...</div>
      </div>
    )
  }

  if (!organization) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-[--text-secondary]">No organization found.</p>
          <p className="text-sm text-[--text-tertiary]">
            Create a StudioOS project to get started.
          </p>
        </div>
      </div>
    )
  }

  const { departments, governanceAgents } = organization.structure

  const getAgentIdentity = (agentRef: GovernanceAgentRef) =>
    identities.find((i) => i.instanceId === agentRef.identityId)

  const getDepartmentStatus = (dept: Department) => {
    const deptAgents = governanceAgents.filter((a) => a.department === dept.type)
    const active = deptAgents.some((a) => {
      const ident = getAgentIdentity(a)
      return ident && ident.performance.tasksCompleted > 0
    })
    return active ? 'active' : 'idle'
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Global CEO */}
        <OrgNode
          name="Global CEO"
          identity={getAgentIdentity(
            governanceAgents.find((a) => a.role === 'global-ceo')!
          )}
          isRoot
        />

        {/* Departments */}
        <div className="ml-8 space-y-3">
          {departments.map((dept) => {
            const deptAgent = governanceAgents.find(
              (a) => a.department === dept.type && a.role === 'dept-ceo'
            )
            const identity = deptAgent ? getAgentIdentity(deptAgent) : undefined

            return (
              <div key={dept.id} className="space-y-2">
                <OrgNode
                  name={dept.name}
                  identity={identity}
                  status={getDepartmentStatus(dept)}
                  department={dept}
                />
                {/* Workers (shown as leaf nodes) */}
                {dept.agents.length > 0 && (
                  <div className="ml-8 space-y-1">
                    {dept.agents.map((agent) => (
                      <OrgNode
                        key={agent.id}
                        name={agent.name}
                        status={agent.status === 'executing' ? 'busy' : 'idle'}
                        isWorker
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function OrgNode({
  name,
  identity,
  status,
  isRoot,
  isWorker,
  department,
}: {
  name: string
  identity?: {
    name?: string
    performance?: { tasksCompleted: number; successRate: number; promotionScore: number }
    skills?: Array<{ name: string; level: string }>
  } | undefined
  status?: string
  isRoot?: boolean
  isWorker?: boolean
  department?: Department
}) {
  const statusColor =
    status === 'active' || status === 'busy'
      ? 'text-green-500'
      : status === 'idle'
        ? 'text-gray-400'
        : 'text-yellow-500'

  return (
    <div
      className={`rounded-lg border border-[--border] p-3 ${
        isRoot ? 'bg-[--surface]' : 'bg-[--surface-secondary]'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`text-lg ${statusColor}`}>
          {isWorker ? '👷' : isRoot ? '🏢' : '💻'}
        </span>
        <div className="flex-1">
          <div className="font-medium text-[--text-primary]">{identity?.name || name}</div>
          {identity && !isWorker && (
            <div className="text-xs text-[--text-secondary] space-x-3">
              <span>{identity.performance.tasksCompleted} decisions</span>
              <span>
                {((identity.performance.successRate || 0) * 100).toFixed(0)}% success
              </span>
              <span>Score: {identity.performance.promotionScore}</span>
            </div>
          )}
          {identity?.skills && identity.skills.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {identity.skills.slice(0, 3).map((s) => (
                <span
                  key={s.name}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-[--surface-tertiary] text-[--text-tertiary]"
                >
                  {s.name} ({s.level})
                </span>
              ))}
            </div>
          )}
        </div>
        <StatusDot status={status || 'idle'} />
      </div>
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-500',
    busy: 'bg-yellow-500',
    idle: 'bg-gray-400',
    error: 'bg-red-500',
    executing: 'bg-yellow-500',
  }

  return (
    <div className={`w-2.5 h-2.5 rounded-full ${colors[status] || 'bg-gray-400'}`} />
  )
}
