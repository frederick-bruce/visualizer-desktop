import { usePlayerStore } from '@/store/player'
import { useUiStore } from '@/store/ui'

const VISUALIZERS: { id: 'bars'|'wave'|'particles'; label: string }[] = [
  { id: 'bars', label: 'Bars' },
  { id: 'wave', label: 'Wave' },
  { id: 'particles', label: 'Particles' }
]

export function SidebarFooter() {
  const { visualizer, setVisualizer } = usePlayerStore() as any
  const { sidebarCollapsed } = useUiStore()
  return (
    <div className="p-2 border-t border-white/5 bg-white/5/40 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        {VISUALIZERS.map(v => {
          const active = visualizer === v.id
          return (
            <button
              key={v.id}
              aria-label={v.label}
              title={v.label}
              onClick={() => setVisualizer(v.id)}
              className={[
                'flex-1 rounded-md h-8 text-[11px] font-medium uppercase tracking-wide flex items-center justify-center',
                'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
                active ? 'bg-[var(--accent)] text-black' : 'bg-white/10 hover:bg-white/15 text-white/70'
              ].join(' ')}
            >
              {sidebarCollapsed ? v.label[0] : v.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
