import { usePlayerStore } from '@/store/player'
import { SidebarShell } from './ui'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// Simple windowed list virtualization (no external dep)
function useVirtual<T>(items: T[], rowHeight: number, viewportRef: React.RefObject<HTMLDivElement | null>) {
	const [scrollTop, setScrollTop] = useState(0)
	const [height, setHeight] = useState(0)
	useEffect(() => {
		const el = viewportRef.current
		if (!el) return
		const onScroll = () => setScrollTop(el.scrollTop)
		const ro = new ResizeObserver(r => { if (r[0]) setHeight(el.clientHeight) })
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

export default function Sidebar() {
	const { playlists, visualizer, setVisualizer, sidebarCollapsed, setSidebarCollapsed } = usePlayerStore()
	const [query, setQuery] = useState('')
	const viewportRef = useRef<HTMLDivElement | null>(null)
	const searchRef = useRef<HTMLInputElement | null>(null)
	const listRef = useRef<HTMLDivElement | null>(null)
	const [activeIndex, setActiveIndex] = useState(0)

	const collapsed = sidebarCollapsed

	// Filter playlists (case-insensitive)
	const filtered = useMemo(() => {
		if (!query.trim()) return playlists
		const q = query.toLowerCase()
		return playlists.filter(p => p.name?.toLowerCase().includes(q))
	}, [playlists, query])

	const rowHeight = collapsed ? 56 : 56 // constant for simple math
	const virtual = useVirtual(filtered, rowHeight, viewportRef)

	// Keyboard shortcuts: / focuses search, Esc clears, arrows navigate list
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === '/' && !collapsed) {
				e.preventDefault(); searchRef.current?.focus(); return
			}
			if (e.key === 'Escape') {
				if (document.activeElement === searchRef.current) {
					setQuery(''); (searchRef.current as HTMLInputElement).blur(); return
				}
			}
			if (['ArrowDown','ArrowUp'].includes(e.key) && filtered.length) {
				if (document.activeElement === searchRef.current || document.activeElement === document.body) {
					e.preventDefault()
					setActiveIndex(i => {
						const next = e.key === 'ArrowDown' ? Math.min(filtered.length - 1, i + 1) : Math.max(0, i - 1)
						return next
					})
				}
			}
			if (e.key === 'Enter' && filtered[activeIndex]) {
				// play selected
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
	}, [filtered, activeIndex, collapsed])

	// Ensure active item kept in view when navigating
	useEffect(() => {
		const el = viewportRef.current
		if (!el) return
		const top = activeIndex * rowHeight
		const bottom = top + rowHeight
		if (top < el.scrollTop) el.scrollTop = top
		else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight
	}, [activeIndex])

	const toggleCollapsed = useCallback(() => setSidebarCollapsed(!collapsed), [collapsed, setSidebarCollapsed])

	return (
		<div
			className={[
				'h-full flex flex-col rounded-xl overflow-hidden border border-white/10 bg-gradient-to-b from-[#1c2227] to-[#13161a]',
				'transition-[width] duration-200 ease-out',
				'will-change-width',
				'data-[reduced-motion=true]:transition-none',
				collapsed ? 'w-[72px]' : 'w-[220px] md:w-[240px]'
			].join(' ')}
			data-reduced-motion={window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'true':'false'}
		>
			{/* Header / toggle */}
			<div className="flex items-center justify-between px-2 pt-2 pb-1">
				{!collapsed && <div className="text-[11px] font-semibold tracking-wide text-white/70">Library</div>}
				<button
					onClick={toggleCollapsed}
					aria-label="Toggle sidebar"
					className="h-7 w-7 flex items-center justify-center rounded-md bg-white/5 hover:bg-white/10 text-xs text-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-dynamic)]"
				>{collapsed ? '⟩' : '⟨'}</button>
			</div>

			{/* Search */}
			{!collapsed && (
				<div className="px-2 pb-2">
					<input
						ref={searchRef}
						value={query}
						onChange={e => setQuery(e.target.value)}
						placeholder="Search playlists (/ )"
						className="w-full px-2 py-1.5 text-xs rounded-md bg-white/5 border border-white/10 focus:outline-none focus:ring-1 focus:ring-[var(--accent-dynamic)]"
					/>
				</div>
			)}

			{/* Virtualized list */}
			<div ref={viewportRef} className="flex-1 overflow-auto focus:outline-none" tabIndex={-1}>
				<div style={{ height: virtual.total + 'px', position: 'relative' }}>
					<div style={{ transform: `translateY(${virtual.offset}px)` }} className="absolute inset-x-0 top-0">
						{virtual.slice.map((p: any, i) => {
							const absoluteIndex = i + (virtual.offset / rowHeight)
							const active = absoluteIndex === activeIndex
							return (
								<button
									key={p.id}
									onClick={() => {
										setActiveIndex(absoluteIndex)
										fetch(`https://api.spotify.com/v1/me/player/play`, {
											method: 'PUT',
											headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}`, 'Content-Type': 'application/json' },
											body: JSON.stringify({ context_uri: p.uri })
										}).catch(()=>{})
									}}
									className={[
										'group w-full flex items-center gap-2 px-2 rounded-md transition-colors',
										'h-14',
										active ? 'bg-[var(--accent-dynamic)]/20 ring-1 ring-[var(--accent-dynamic)]' : 'hover:bg-white/10'
									].join(' ')}
									style={{ outline: 'none' }}
									aria-current={active || undefined}
								>
									<div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-white/5">
										{p.images?.[0]?.url && <img src={p.images[0].url} alt="" className="w-full h-full object-cover" />}
									</div>
									{!collapsed && (
										<div className="flex-1 min-w-0 text-left">
											<div className="text-xs font-medium truncate text-white/90">{p.name}</div>
											<div className="text-[10px] text-white/50">{p.tracks?.total ?? ''} tracks</div>
										</div>
									)}
								</button>
							)
						})}
					</div>
				</div>
			</div>

			{/* Visualizer selector */}
			<div className="p-2 border-t border-white/5 bg-white/5/50 backdrop-blur-sm">
				<div className="flex items-center gap-1">
					{(['bars','wave','particles'] as const).map(v => {
						const active = visualizer === v
						return (
							<button
								key={v}
								onClick={() => setVisualizer(v)}
								aria-label={`Set visualizer ${v}`}
								className={[
									'flex-1 rounded-md h-7 text-[11px] font-medium uppercase tracking-wide',
									'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-dynamic)]',
									active ? 'bg-[var(--accent-dynamic)] text-black' : 'bg-white/10 hover:bg-white/15 text-white/70'
								].join(' ')}
							>{collapsed ? v[0] : v}</button>
						)
					})}
				</div>
			</div>
		</div>
	)
}