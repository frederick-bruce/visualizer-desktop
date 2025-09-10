import { ReactNode } from 'react'

export function SidebarSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="px-2 pb-2">
      {title && <div className="text-[10px] uppercase tracking-wide text-white/40 px-1 mb-1">{title}</div>}
      {children}
    </div>
  )
}
