import React from 'react'

export function SidebarShell({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <div className={`h-full flex flex-col p-3 md:p-4 gap-3 md:gap-4 bg-gradient-to-b from-[#1f252b] to-[#181a1d] ${className}`}>{children}</div>
}

export function SectionTitle({ children }: { children?: React.ReactNode }) {
  return <h3 className="text-sm uppercase tracking-wide text-white/60 mb-3">{children}</h3>
}

export default SidebarShell
