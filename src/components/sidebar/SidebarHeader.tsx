import { useUiStore } from '@/store/ui'
import { useEffect } from 'react'

export function SidebarHeader() {
  const { toggleSidebar, sidebarCollapsed } = useUiStore()

  // Keyboard: Ctrl + ` toggles
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '`') { e.preventDefault(); toggleSidebar() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleSidebar])

  return (
    <div className="flex items-center h-12 px-3 gap-2">
      <button
        onClick={toggleSidebar}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="relative flex items-center justify-center h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <span aria-hidden>{sidebarCollapsed ? '⟩' : '⟨'}</span>
      </button>
      {!sidebarCollapsed && <div className="text-[11px] font-semibold tracking-wide text-white/70">Library</div>}
    </div>
  )
}
