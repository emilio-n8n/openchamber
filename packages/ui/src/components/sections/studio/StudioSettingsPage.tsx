// StudioOS — Settings page

import { useStudioStore } from '../../stores/studio/useStudioStore'
import { ModeSwitcher } from '../studio/ModeSwitcher'

export function StudioSettingsPage() {
  const mode = useStudioStore((s) => s.mode)
  const projects = useStudioStore((s) => s.projects)

  return (
    <div className="space-y-6 p-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-[--text-primary]">StudioOS</h2>
        <p className="text-sm text-[--text-secondary] mt-1">
          Configure your organization mode and projects.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-lg border border-[--border]">
          <div>
            <div className="font-medium text-[--text-primary]">Mode</div>
            <div className="text-sm text-[--text-secondary]">
              {mode === 'studio' ? 'Organization mode active' : 'Classic mode'}
            </div>
          </div>
          <ModeSwitcher />
        </div>

        {projects.length > 0 && (
          <div className="space-y-2">
            <div className="font-medium text-[--text-primary]">Projects</div>
            {projects.map((p) => (
              <div key={p.id} className="p-3 rounded-lg border border-[--border] text-sm">
                <div className="font-medium text-[--text-primary]">{p.name}</div>
                <div className="text-[--text-tertiary]">{p.directory}</div>
              </div>
            ))}
          </div>
        )}

        <div className="p-4 rounded-lg border border-[--border] bg-[--surface-secondary]">
          <div className="font-medium text-[--text-primary] mb-2">About StudioOS</div>
          <div className="text-sm text-[--text-secondary] space-y-1">
            <p>StudioOS transforms OpenChamber into an Operating System for AI Organizations.</p>
            <p className="text-xs text-[--text-tertiary] mt-2">
              Organization Runtime • Identity System • Orchestrator • ExecutionProvider
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
