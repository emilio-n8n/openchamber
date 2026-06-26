// StudioOS — Onboarding flow (create project + generate organization)

import { useState } from 'react'
import { useStudioStore } from '@/stores/studio/useStudioStore'
import { createProject, getOrganization } from '@/lib/studio/api'
import { useOrganizationStore } from '@/stores/studio/useOrganizationStore'
import type { Organization } from '@/lib/studio/types'

type Step = 'welcome' | 'select-directory' | 'generating' | 'ready'

export function StudioOnboarding() {
  const [step, setStep] = useState<Step>('welcome')
  const [directory, setDirectory] = useState('')
  const [projectName, setProjectName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const addProject = useStudioStore((s) => s.addProject)
  const setActiveProject = useStudioStore((s) => s.setActiveProject)
  const setOnboarding = useStudioStore((s) => s.setOnboarding)
  const setOrganization = useOrganizationStore((s) => s.setOrganization)

  async function handleCreate() {
    if (!directory.trim()) {
      setError('Please enter a workspace directory')
      return
    }

    setStep('generating')
    setError(null)

    const projectId = `studio_${Date.now()}`
    const name = projectName || `Project ${projectId.slice(-6)}`

    const result = await createProject(projectId, directory, name)

    if (result.error) {
      setError(result.error)
      setStep('select-directory')
      return
    }

    // Fetch the organization
    const orgResult = await getOrganization(projectId)
    if (orgResult.data) {
      setOrganization(orgResult.data as Organization)
    }

    addProject({
      id: projectId,
      name,
      directory,
      status: 'active',
      isActive: true,
      taskCount: 0,
      activeTaskCount: 0,
      agentCount: 0,
    })
    setActiveProject(projectId)
    setStep('ready')
  }

  function handleFinish() {
    setOnboarding(false)
  }

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        {step === 'welcome' && (
          <div className="text-center space-y-4">
            <div className="text-4xl">🏢</div>
            <h2 className="text-xl font-semibold text-[--text-primary]">
              Welcome to StudioOS
            </h2>
            <p className="text-[--text-secondary] text-sm">
              StudioOS transforms your project into an AI organization.
              Create or select a project to get started.
            </p>
            <button
              onClick={() => setStep('select-directory')}
              className="px-6 py-2 bg-[--accent] text-white rounded-lg hover:opacity-90"
            >
              Create Project
            </button>
          </div>
        )}

        {step === 'select-directory' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[--text-primary]">
              Configure Project
            </h2>

            <div className="space-y-2">
              <label className="text-sm text-[--text-secondary]">
                Project Name (optional)
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="My Awesome Project"
                className="w-full px-3 py-2 rounded-lg border border-[--border] bg-[--surface] text-[--text-primary] text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-[--text-secondary]">
                Workspace Directory *
              </label>
              <input
                type="text"
                value={directory}
                onChange={(e) => setDirectory(e.target.value)}
                placeholder="/Users/me/projects/my-app"
                className="w-full px-3 py-2 rounded-lg border border-[--border] bg-[--surface] text-[--text-primary] text-sm"
              />
              <p className="text-xs text-[--text-tertiary]">
                All agents will work in this directory.
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setStep('welcome')}
                className="px-4 py-2 text-sm text-[--text-secondary] hover:text-[--text-primary]"
              >
                Back
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 px-4 py-2 bg-[--accent] text-white rounded-lg hover:opacity-90 text-sm"
              >
                Generate Organization
              </button>
            </div>
          </div>
        )}

        {step === 'generating' && (
          <div className="text-center space-y-4">
            <div className="text-4xl animate-pulse">⚙️</div>
            <h2 className="text-lg font-semibold text-[--text-primary]">
              Generating your organization...
            </h2>
            <p className="text-sm text-[--text-secondary] space-y-1">
              <div>Analyzing project structure...</div>
              <div>Creating Global CEO...</div>
              <div>Setting up departments...</div>
              <div>Creating worker agents...</div>
            </p>
          </div>
        )}

        {step === 'ready' && (
          <div className="text-center space-y-4">
            <div className="text-4xl">🎉</div>
            <h2 className="text-lg font-semibold text-[--text-primary]">
              Your organization is ready!
            </h2>
            <p className="text-sm text-[--text-secondary]">
              StudioOS has created your AI organization with departments and agents.
              Start by submitting a task to the Global CEO.
            </p>
            <button
              onClick={handleFinish}
              className="px-6 py-2 bg-[--accent] text-white rounded-lg hover:opacity-90"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
