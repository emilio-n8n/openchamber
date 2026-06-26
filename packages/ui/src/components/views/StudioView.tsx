// StudioOS — Main view router

import { useState, useEffect } from 'react'
import { OrganizationView } from './OrganizationView'
import { StudioTasksView } from './StudioTasksView'
import { StudioLiveView } from './StudioLiveView'
import { StudioOnboarding } from '../studio/StudioOnboarding'
import { useStudioStore } from '../../stores/studio/useStudioStore'
import { ModeSwitcher } from '../studio/ModeSwitcher'
import { createLiveStream } from '../../lib/studio/api'
import { handleStudioEvent } from '../../sync/studio-sync'

type StudioTab = 'organization' | 'tasks' | 'live'

export function StudioView() {
  const [activeTab, setActiveTab] = useState<StudioTab>('organization')
  const isOnboarding = useStudioStore((s) => s.isOnboarding)
  const activeProjectId = useStudioStore((s) => s.activeProjectId)

  // Connect SSE stream globally when Studio mode is active
  useEffect(() => {
    if (!activeProjectId) return
    const cleanup = createLiveStream(activeProjectId, (event) => {
      handleStudioEvent(event as never)
    })
    return cleanup
  }, [activeProjectId])

  if (isOnboarding) {
    return <StudioOnboarding />
  }

  if (!activeProjectId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold text-[--text-primary]">
            No StudioOS project selected
          </h2>
          <p className="text-[--text-secondary]">
            Create or select a project to get started.
          </p>
          <button
            onClick={() => useStudioStore.getState().setOnboarding(true)}
            className="px-4 py-2 bg-[--accent] text-white rounded-lg hover:opacity-90"
          >
            Create Project
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <StudioHeader activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 overflow-hidden">
        {activeTab === 'organization' && <OrganizationView />}
        {activeTab === 'tasks' && <StudioTasksView />}
        {activeTab === 'live' && <StudioLiveView />}
      </div>
    </div>
  )
}

function StudioHeader({
  activeTab,
  onTabChange,
}: {
  activeTab: StudioTab
  onTabChange: (tab: StudioTab) => void
}) {
  const tabs: { id: StudioTab; label: string; icon: string }[] = [
    { id: 'organization', label: 'Organization', icon: '🏢' },
    { id: 'tasks', label: 'Tasks', icon: '📋' },
    { id: 'live', label: 'Live', icon: '👁' },
  ]

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-[--border]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            activeTab === tab.id
              ? 'bg-[--accent] text-white'
              : 'text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--surface-hover]'
          }`}
        >
          {tab.icon} {tab.label}
        </button>
      ))}
      <div className="ml-auto flex items-center gap-2">
        <ModeSwitcher />
      </div>
    </div>
  )
}
