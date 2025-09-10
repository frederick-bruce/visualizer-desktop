import { ReactNode, useEffect, useRef } from 'react'
import { useUiStore } from '@/store/ui'

interface SidebarShellProps {
  children: ReactNode
}

export function SidebarShell({ children }: SidebarShellProps) {
  const { sidebarCollapsed } = useUiStore()
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!ref.current) return
    // containment optimization
    ref.current.style.contain = 'layout style paint'
  }, [])
  return (
    <nav
      aria-label="Sidebar"
      ref={ref}
      data-collapsed={sidebarCollapsed ? 'true' : 'false'}
      className={[
        'relative h-full flex flex-col rounded-xl border border-white/10 bg-gradient-to-b from-zinc-900/40 to-zinc-900/20 backdrop-blur-sm',
        'transition-[width] duration-200 ease-out data-[reduced-motion=true]:transition-none',
        'will-change-[width] overflow-hidden group/sidebar',
        sidebarCollapsed ? 'w-[var(--sb-rail-w,72px)]' : 'w-[var(--sb-w,272px)]',
        'min-w-[256px] max-w-[304px] data-[collapsed=true]:min-w-[72px] data-[collapsed=true]:max-w-[72px]'
      ].join(' ')}
    >
      {children}
    </nav>
  )
}
