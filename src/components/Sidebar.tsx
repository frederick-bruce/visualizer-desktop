import { useEffect } from 'react'
import { usePlayerStore } from '@/store/player'
import { Button, Card, SidebarShell, SectionTitle } from './ui'
import { useState } from 'react'
import { pill } from '@/lib/theme'


export default function Sidebar() {
	const { isAuthed, setVisualizer, visualizer, profile, playlists } = usePlayerStore()
	const [collapsed, setCollapsed] = useState(true)
	const [query, setQuery] = useState('')

	const filtered = query
		? playlists.filter((p) => p.name?.toLowerCase().includes(query.toLowerCase()))
		: playlists

	return (
		<SidebarShell className="p-3 gap-3 w-[72px] md:w-[220px] lg:w-[260px]">
			{/* Collapse toggle */}
			<div className="flex items-center justify-end">
				<button className="text-xs text-white/60" onClick={() => setCollapsed(s => !s)} aria-label="Toggle sidebar">
					{collapsed ? '⟩' : '⟨'}
				</button>
			</div>

			{/* Search input (hidden when collapsed) */}
			{!collapsed && (
				<div className="mb-1">
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search playlists"
						className="w-full px-2 py-1.5 text-xs rounded-md bg-white/5 border border-white/10 focus:outline-none focus:ring-1 focus:ring-[var(--accent-dynamic)]"
					/>
				</div>
			)}

			{/* Playlists compact list */}
			<div className={`overflow-auto pr-1 scrollbar-hidden fade-mask-bottom ${collapsed ? 'sidebar-collapsed' : ''}`}>
				<div className="grid gap-1">
					{(filtered.length ? filtered : playlists).map((p) => (
						<button
							key={p.id}
							onClick={() => {
								fetch(`https://api.spotify.com/v1/me/player/play`, {
									method: 'PUT',
									headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}`, 'Content-Type': 'application/json' },
									body: JSON.stringify({ context_uri: p.uri })
								})
							}}
							className="flex items-center gap-2 text-left p-2 rounded-md hover:bg-white/10 transition-smooth"
						>
							<div className="w-10 h-10 rounded overflow-hidden flex-shrink-0">
								{p.images?.[0]?.url ? (
									<img src={p.images[0].url} alt={p.name} className="w-full h-full object-cover" />
								) : (
									<div className="w-full h-full bg-white/6 flex items-center justify-center text-[10px]">PL</div>
								)}
							</div>
							{!collapsed && (
								<div className="flex-1 min-w-0">
									<div className="text-sm leading-tight truncate">{p.name}</div>
									<div className="text-[10px] text-white/50">{p.tracks?.total ?? ''} tracks</div>
								</div>
							)}
						</button>
					))}
				</div>
			</div>

			{/* Visualizer selector (icons only when collapsed) */}
			<div className="mt-auto">
				{(() => {
					const modes = ['bars','wave','particles'] as const
					const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
						if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
						e.preventDefault()
						const idx = modes.indexOf(visualizer)
						const next = e.key === 'ArrowRight' ? (idx + 1) % modes.length : (idx - 1 + modes.length) % modes.length
						setVisualizer(modes[next])
					}
					const segBase = 'flex items-center rounded-full bg-white/10 p-1 gap-1'
					const segItem = (active: boolean) => [
						'flex-1 text-center rounded-full py-1.5 text-xs transition-smooth select-none cursor-pointer focus:outline-none',
						active ? 'bg-[var(--accent-dynamic)] text-black ring-1 ring-black/10' : 'text-white/80 hover:bg-white/10',
					].join(' ')
					return (
						<div role="radiogroup" aria-label="Visualizer mode" tabIndex={0} onKeyDown={onKey} className={segBase}>
							{modes.map(v => (
								<button key={v} type="button" role="radio" aria-checked={visualizer===v} className={segItem(visualizer===v)} onClick={() => setVisualizer(v)}>
									{collapsed ? v[0].toUpperCase() : v}
								</button>
							))}
						</div>
					)
				})()}
			</div>
		</SidebarShell>
	)
}