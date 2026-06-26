// StudioOS — Mode switcher (OpenChamber ↔ StudioOS)

import { useStudioStore } from '@/stores/studio/useStudioStore'
import { useUIStore } from '@/stores/useUIStore'

export function ModeSwitcher() {
  const mode = useStudioStore((s) => s.mode)
  const switchMode = useStudioStore((s) => s.switchMode)
  const setActiveMainTab = useUIStore((s) => s.setActiveMainTab)
  const activeMainTab = useUIStore((s) => s.activeMainTab)

  const isStudio = mode === 'studio'
  const isStudioTabActive = activeMainTab === 'studio'

  function handleSwitch(target: 'openchamber' | 'studio') {
    switchMode(target)
    if (target === 'studio') {
      setActiveMainTab('studio')
    } else if (isStudioTabActive) {
      setActiveMainTab('chat')
    }
  }

  return (
    <div className="flex items-center gap-1 bg-[--surface-secondary] rounded-lg p-0.5 border border-[--border]">
      <button
        onClick={() => handleSwitch('openchamber')}
        className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
          !isStudio
            ? 'bg-[--surface] text-[--text-primary] shadow-sm'
            : 'text-[--text-tertiary] hover:text-[--text-primary]'
        }`}
      >
        OpenChamber
      </button>
      <button
        onClick={() => handleSwitch('studio')}
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
