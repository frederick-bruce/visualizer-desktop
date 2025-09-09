import React from 'react'

export function SidebarShell({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  // p-6 (24px), gap-6 (24px)
  return <div className={`h-full flex flex-col p-6 gap-6 bg-gradient-to-b from-[#23232a] to-[#18181b] ${className}`}>{children}</div>
}

export function SectionTitle({ children }: { children?: React.ReactNode }) {
  return <h3 className="text-sm uppercase tracking-wide text-white/60 mb-3">{children}</h3>
}

export default SidebarShell
