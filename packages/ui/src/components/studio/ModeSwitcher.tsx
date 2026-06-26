// StudioOS — Mode switcher (OpenChamber ↔ StudioOS)

import { useStudioStore } from '../../stores/studio/useStudioStore'

export function ModeSwitcher() {
  const mode = useStudioStore((s) => s.mode)
  const switchMode = useStudioStore((s) => s.switchMode)

  const isStudio = mode === 'studio'

  return (
    <div className="flex items-center gap-1 bg-[--surface-secondary] rounded-lg p-0.5 border border-[--border]">
      <button
        onClick={() => switchMode('openchamber')}
        className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
          !isStudio
            ? 'bg-[--surface] text-[--text-primary] shadow-sm'
            : 'text-[--text-tertiary] hover:text-[--text-primary]'
        }`}
      >
        OpenChamber
      </button>
      <button
        onClick={() => switchMode('studio')}
        className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
          isStudio
            ? 'bg-[--surface] text-[--text-primary] shadow-sm'
            : 'text-[--text-tertiary] hover:text-[--text-primary]'
        }`}
      >
        StudioOS
      </button>
    </div>
  )
}
