import { forwardRef } from 'react'

interface SidebarSearchProps {
  value: string
  onChange(v: string): void
  hidden?: boolean
}

export const SidebarSearch = forwardRef<HTMLInputElement, SidebarSearchProps>(function SidebarSearch({ value, onChange, hidden }, ref) {
  if (hidden) return null
  return (
    <div className="px-3 pb-2">
      <input
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Search playlists ( / )"
        className="w-full px-2 py-1.5 text-xs rounded-md bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
      />
    </div>
  )
})
