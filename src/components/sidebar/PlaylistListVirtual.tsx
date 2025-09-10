import { useEffect, useMemo, useRef, useState } from 'react'
import { usePlayerStore } from '@/store/player'
import { useUiStore } from '@/store/ui'

interface PlaylistListVirtualProps {
  query: string
}

const ROW_H = 48

function useVirtual<T>(items: T[], rowHeight: number, viewportRef: React.RefObject<HTMLDivElement | null>) {
  const [scrollTop, setScrollTop] = useState(0)
  const [height, setHeight] = useState(0)
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onScroll = () => setScrollTop(el.scrollTop)
    const ro = new ResizeObserver(() => { setHeight(el.clientHeight) })
    el.addEventListener('scroll', onScroll)
    ro.observe(el)
    setHeight(el.clientHeight)
    return () => { el.removeEventListener('scroll', onScroll); ro.disconnect() }
  }, [viewportRef])
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 4)
  const end = Math.min(items.length, Math.ceil((scrollTop + height) / rowHeight) + 4)
  const slice = items.slice(start, end)
  const offset = start * rowHeight
  return { slice, offset, total: items.length * rowHeight }
}

export function PlaylistListVirtual({ query }: PlaylistListVirtualProps) {
  const { playlists } = usePlayerStore()
  const { sidebarCollapsed } = useUiStore()
  const [activeIndex, setActiveIndex] = useState(0)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  const filtered = useMemo(() => {
    if (!query.trim()) return playlists
    const q = query.toLowerCase()
    return playlists.filter(p => p.name?.toLowerCase().includes(q))
  }, [playlists, query])

  const virtual = useVirtual(filtered, ROW_H, viewportRef)

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowDown','ArrowUp','Home','End','PageDown','PageUp','Enter'].includes(e.key)) {
        if (document.activeElement && document.activeElement.tagName === 'INPUT') return
      }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(filtered.length - 1, i + 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(0, i - 1)) }
      if (e.key === 'Home') { setActiveIndex(0) }
      if (e.key === 'End') { setActiveIndex(filtered.length - 1) }
      if (e.key === 'PageDown') { setActiveIndex(i => Math.min(filtered.length - 1, i + 10)) }
      if (e.key === 'PageUp') { setActiveIndex(i => Math.max(0, i - 10)) }
      if (e.key === 'Enter' && filtered[activeIndex]) {
        const p = filtered[activeIndex]
        fetch(`https://api.spotify.com/v1/me/player/play`, {
          method: 'PUT',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ context_uri: p.uri })
        }).catch(()=>{})
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [filtered, activeIndex])

  // Keep active visible
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const top = activeIndex * ROW_H
    const bottom = top + ROW_H
    if (top < el.scrollTop) el.scrollTop = top
    else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight
  }, [activeIndex])

  if (!playlists.length && !query) {
    return (
      <div className="px-3 py-6 text-center text-xs text-white/50 space-y-3">
        <div className="text-white/70 font-medium">No playlists yet</div>
        <p className="leading-relaxed">Follow playlists or create your own in Spotify. They’ll appear here.</p>
        <a href="https://open.spotify.com/" target="_blank" className="inline-block px-3 py-1.5 rounded bg-[var(--accent)]/20 text-[var(--accent)] text-xs font-medium hover:bg-[var(--accent)]/30">Open Spotify</a>
      </div>
    )
  }

  if (!!playlists.length && !filtered.length && query) {
    return <div className="px-3 py-6 text-center text-xs text-white/50">No matches for “{query}”.</div>
  }

  return (
    <div ref={viewportRef} role="listbox" aria-label="Playlists" className="flex-1 overflow-auto focus:outline-none" tabIndex={-1}>
      {!!virtual.slice.length && (
        <div style={{ height: virtual.total + 'px', position: 'relative' }} ref={listRef}>
          <div style={{ transform: `translateY(${virtual.offset}px)` }} className="absolute inset-x-0 top-0">
            {virtual.slice.map((p: any, i) => {
              const absoluteIndex = i + (virtual.offset / ROW_H)
              const active = absoluteIndex === activeIndex
              return (
                <div
                  key={p.id}
                  role="option"
                  aria-selected={active || undefined}
                  className={[
                    'group flex items-center gap-2 px-2 rounded-md transition-colors h-12',
                    active ? 'bg-white/5 ring-1 ring-[var(--accent)]/40' : 'hover:bg-white/5'
                  ].join(' ')}
                  onClick={() => {
                    setActiveIndex(absoluteIndex)
                    fetch(`https://api.spotify.com/v1/me/player/play`, {
                      method: 'PUT',
                      headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ context_uri: p.uri })
                    }).catch(()=>{})
                  }}
                  title={p.name}
                >
                  <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-white/5">
                    {p.images?.[0]?.url && <img src={p.images[0].url} alt="" className="w-full h-full object-cover" />}
                  </div>
                  {!sidebarCollapsed && (
                    <div className="flex-1 min-w-0 hidden md:block">
                      <div className="text-xs font-medium truncate text-white/90">{p.name}</div>
                      <div className="text-[10px] text-white/50">{p.tracks?.total ?? ''} tracks</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
