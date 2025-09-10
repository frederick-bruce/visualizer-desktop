import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

// Tab definitions
const TABS: { key: TabKey; label: string }[] = [
  { key: 'library', label: 'Library' },
  { key: 'visualizers', label: 'Visualizers' },
  { key: 'settings', label: 'Settings' },
]

type TabKey = 'library' | 'visualizers' | 'settings'

function clampIndex(i: number) {
  if (i < 0) return 0
  if (i >= TABS.length) return TABS.length - 1
  return i
}

export default function TopTabs() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initial = (searchParams.get('tab') as TabKey) || 'library'
  const [active, setActive] = useState<TabKey>(initial)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const indicatorRef = useRef<HTMLDivElement | null>(null)

  // sync URL when active changes
  useEffect(() => {
    const sp = new URLSearchParams(searchParams)
    sp.set('tab', active)
    setSearchParams(sp, { replace: true })
  }, [active])

  // sync state when URL changes (back/forward nav)
  useEffect(() => {
    const q = searchParams.get('tab') as TabKey | null
    if (q && q !== active) setActive(q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // underline indicator sizing
  useLayoutEffect(() => {
    const idx = TABS.findIndex(t => t.key === active)
    const el = tabRefs.current[idx]
    const ind = indicatorRef.current
    if (el && ind) {
      const r = el.getBoundingClientRect()
      const parentR = el.parentElement!.getBoundingClientRect()
      ind.style.transform = `translateX(${r.left - parentR.left}px)`
      ind.style.width = r.width + 'px'
    }
  }, [active])

  const onKey = (e: React.KeyboardEvent, idx: number) => {
    let targetIndex = idx
    switch (e.key) {
      case 'ArrowRight':
      case 'PageDown':
        targetIndex = clampIndex(idx + 1); break
      case 'ArrowLeft':
      case 'PageUp':
        targetIndex = clampIndex(idx - 1); break
      case 'Home':
        targetIndex = 0; break
      case 'End':
        targetIndex = TABS.length - 1; break
      default:
        return
    }
    e.preventDefault()
    const next = TABS[targetIndex]
    setActive(next.key)
    requestAnimationFrame(() => {
      tabRefs.current[targetIndex]?.focus()
    })
  }

  return (
    <div className="wmp-topbar">
      <div className="wmp-topbar-inner relative" role="tablist" aria-label="Main sections">
        {TABS.map((t, i) => {
          const isActive = t.key === active
          return (
            <button
              key={t.key}
              ref={el => { tabRefs.current[i] = el }}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              className={['wmp-tab', isActive ? 'active' : ''].join(' ')}
              onClick={() => setActive(t.key)}
              onKeyDown={(e) => onKey(e, i)}
              type="button"
            >
              {t.label}
            </button>
          )
        })}
        <div ref={indicatorRef} aria-hidden="true" className="pointer-events-none absolute -bottom-px h-[2px] bg-[var(--accent,#1DB954)] transition-transform duration-200 will-change-transform" />
      </div>
    </div>
  )
}
 