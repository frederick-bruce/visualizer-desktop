import React from 'react'
import { useUiStore } from '@/store/ui'

export type HeaderBarProps = {
  trackTitle?: string
  trackArtist?: string
  artworkUrl?: string
  deviceName?: string
  deviceConnected: boolean
  onToggleSidebar(): void
  devicePicker: React.ReactNode
}

export default function HeaderBar({ trackTitle, trackArtist, artworkUrl, deviceName, deviceConnected, onToggleSidebar, devicePicker }: HeaderBarProps) {
  const drawerOpen = useUiStore(s => s.drawerOpen)
  return (
    <div className="h-12 px-2 md:px-4 flex items-center justify-between gap-2" role="banner">
      {/* Left: mobile sidebar toggle */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          className="md:hidden h-9 w-9 rounded-md bg-white/5 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          aria-label="Toggle sidebar"
          aria-expanded={drawerOpen}
          aria-controls="mobile-sidebar"
          onClick={onToggleSidebar}
          data-testid="sidebar-toggle"
        >
          <span className="sr-only">Toggle Sidebar</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
        {/* Track info */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded bg-white/10 overflow-hidden flex items-center justify-center">
            {artworkUrl ? <img src={artworkUrl} alt="Album art" className="w-full h-full object-cover"/> : <div className="text-[10px] text-white/40">—</div>}
          </div>
          <div className="min-w-0">
            <div className="text-[13px] truncate" title={trackTitle}>{trackTitle || '—'}</div>
            <div className="text-[11px] text-white/60 truncate" title={trackArtist}>{trackArtist || ''}</div>
          </div>
        </div>
      </div>

      {/* Right: device picker + status */}
      <div className="flex items-center gap-2">
        <div data-testid="device-picker" aria-label="Device picker">{devicePicker}</div>
        <span
          className={`px-2 py-1 rounded text-[11px] border ${deviceConnected ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-amber-500/15 border-amber-500/30 text-amber-200'}`}
          role="status"
          aria-live="polite"
          data-testid="connection-chip"
        >
          {deviceConnected ? (deviceName ? `Connected — ${deviceName}` : 'Connected') : 'No active device'}
        </span>
      </div>
    </div>
  )
}
