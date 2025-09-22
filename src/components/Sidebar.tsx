import React, { useEffect, useMemo, useState } from 'react'
import { useUiStore } from '@/store/ui'
import PresetPicker from '@/components/PresetPicker'
import { usePlayerStore } from '@/store/player'
import { useVisualizerState } from '@/state/visualizerStore'
import { getAccessToken } from '@/lib/spotifyAuth'
import { Me } from '@/lib/spotifyApi'

type TabKey = 'presets' | 'library' | 'settings'

export default function Sidebar() {
	const { sidebarCollapsed, toggleSidebar } = useUiStore()
	const [tab, setTab] = useState<TabKey>('presets')

	return (
		<aside className={`h-full border-r border-neutral-800 bg-neutral-900/40 ${sidebarCollapsed ? 'w-[56px]' : 'w-[300px]'} transition-[width] duration-200 overflow-hidden flex flex-col`}> 
			{/* Header */}
			<div className="h-12 flex items-center gap-2 px-2 border-b border-neutral-800/70">
				<button onClick={toggleSidebar} className="text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10" aria-label="Toggle sidebar">{sidebarCollapsed ? '›' : '‹'}</button>
				{!sidebarCollapsed && (
					<nav className="flex items-center gap-1 text-[12px]">
						<TabBtn active={tab==='presets'} onClick={() => setTab('presets')}>Presets</TabBtn>
						<TabBtn active={tab==='library'} onClick={() => setTab('library')}>Library</TabBtn>
						<TabBtn active={tab==='settings'} onClick={() => setTab('settings')}>Settings</TabBtn>
					</nav>
				)}
			</div>

			{/* Content */}
			<div className="flex-1 min-h-0 overflow-auto p-3">
				{sidebarCollapsed ? null : (
					tab === 'presets' ? (
						<div className="space-y-3">
							<PresetPicker />
						</div>
					) : tab === 'library' ? (
						<LibraryPanel />
					) : (
						<SettingsPanel />
					)
				)}
			</div>
		</aside>
	)
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
	return (
		<button onClick={onClick} className={`px-2 py-1 rounded ${active ? 'bg-white/15 text-white' : 'text-white/70 hover:text-white hover:bg-white/5'}`}>{children}</button>
	)
}

function LibraryPanel() {
	const playlists = (usePlayerStore(s => s.playlists) as any[]) || []
	const [q, setQ] = useState('')
	const [recent, setRecent] = useState<any[]>([])
	const play = (usePlayerStore(s => s.play) as (uri?: string)=>Promise<void>)
	const filtered = useMemo(() => {
		const t = q.trim().toLowerCase()
		if (!t) return playlists
		return playlists.filter((p: any) => (p?.name || '').toLowerCase().includes(t))
	}, [q, playlists])

	const onPlayPlaylist = async (uri?: string) => {
		if (!uri) return
		try {
			const token = await getAccessToken(); if (!token) return
			await fetch('https://api.spotify.com/v1/me/player/play', {
				method: 'PUT',
				headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ context_uri: uri })
			})
		} catch {}
	}

	return (
			<div className="flex flex-col gap-4">
				{/* Recently Played */}
				<RecentlyPlayed recent={recent} onMount={setRecent} onPlay={uri => play(uri)} />

			<input
				type="search"
				placeholder="Search playlists"
				value={q}
				onChange={e => setQ(e.target.value)}
				className="w-full h-9 px-3 rounded-md bg-white/5 border border-white/10 text-sm outline-none focus:ring-2 focus:ring-[var(--accent,#1DB954)]"
			/>
			<div className="flex flex-col gap-1">
				{filtered.map((pl: any) => (
					<button key={pl.id}
						onClick={() => onPlayPlaylist(pl.uri)}
						className="flex items-center gap-3 p-2 rounded hover:bg-white/5 text-left">
						<div className="w-10 h-10 rounded bg-white/5 overflow-hidden flex items-center justify-center">
							{pl.images?.[0]?.url ? <img src={pl.images[0].url} alt="" className="w-full h-full object-cover"/> : <div className="text-[10px] text-white/40">PL</div>}
						</div>
						<div className="min-w-0">
							<div className="text-sm truncate">{pl.name || 'Untitled'}</div>
							<div className="text-[11px] text-white/50 truncate">{pl.tracks?.total ? `${pl.tracks.total} songs` : ''}</div>
						</div>
					</button>
				))}
				{!filtered.length && (
					<div className="text-[12px] text-white/50 px-1">No playlists</div>
				)}
			</div>
		</div>
	)
}

	function RecentlyPlayed({ recent, onMount, onPlay }: { recent: any[]; onMount: (items: any[]) => void; onPlay: (uri?: string)=>void }) {
		useEffect(() => {
			let cancelled = false
			;(async () => {
				try {
					const data: any = await Me.recentlyPlayed().catch(()=> null)
					if (!data?.items) return
					// Dedup by track id (keep first)
					const seen = new Set<string>()
					const out: any[] = []
					for (const it of data.items) {
						const tr = it?.track
						if (!tr?.id || seen.has(tr.id)) continue
						seen.add(tr.id)
						out.push({ id: tr.id, name: tr.name, uri: tr.uri, artists: (tr.artists||[]).map((a:any)=>a.name).join(', '), image: tr.album?.images?.[0]?.url })
					}
					if (!cancelled) onMount(out.slice(0, 15))
				} catch {}
			})()
			return () => { cancelled = true }
		}, [onMount])

		if (!recent?.length) return null
		return (
			<section>
				<div className="text-[12px] font-medium text-white/70 mb-2">Recently played</div>
				<div className="flex flex-col gap-1">
					{recent.map((t: any) => (
						<button key={t.id} onClick={() => onPlay(t.uri)} className="flex items-center gap-3 p-2 rounded hover:bg-white/5 text-left">
							<div className="w-10 h-10 rounded bg-white/5 overflow-hidden flex items-center justify-center">
								{t.image ? <img src={t.image} alt="" className="w-full h-full object-cover"/> : <div className="text-[10px] text-white/40">TR</div>}
							</div>
							<div className="min-w-0">
								<div className="text-sm truncate">{t.name}</div>
								<div className="text-[11px] text-white/50 truncate">{t.artists}</div>
							</div>
						</button>
					))}
				</div>
			</section>
		)
	}

function SettingsPanel() {
	const { inputSource, setInputSource, renderMode, setRenderMode, vizSettings, setVizSettings, lowPowerMode, setLowPowerMode } = usePlayerStore() as any
	const { beatGateEnabled, toggleBeatGate } = useVisualizerState()
	return (
		<div className="flex flex-col gap-4 text-sm">
			<section>
				<div className="font-medium text-white/80 mb-2">Input</div>
				<div className="flex items-center gap-2">
					<label className="flex items-center gap-2"><input type="radio" name="input" checked={inputSource==='Loopback'} onChange={()=>setInputSource('Loopback')} />Loopback</label>
					<label className="flex items-center gap-2"><input type="radio" name="input" checked={inputSource==='File'} onChange={()=>setInputSource('File')} />File</label>
				</div>
			</section>

			<section>
				<div className="font-medium text-white/80 mb-2">Render</div>
				<div className="flex items-center gap-2">
					<label className="flex items-center gap-2"><input type="radio" name="render" checked={renderMode==='raf'} onChange={()=>setRenderMode('raf')} />RAF</label>
					<label className="flex items-center gap-2"><input type="radio" name="render" checked={renderMode==='max'} onChange={()=>setRenderMode('max')} />Max</label>
				</div>
			</section>

			<section>
				<div className="font-medium text-white/80 mb-2">Sensitivity</div>
				<div className="flex items-center gap-3">
					<input type="range" min={0.5} max={2} step={0.05} value={vizSettings?.sensitivity ?? 1} onChange={e=>setVizSettings({ sensitivity: Number(e.target.value) })} className="w-full" />
					<span className="tabular-nums text-white/70 w-10">{(vizSettings?.sensitivity ?? 1).toFixed(2)}</span>
				</div>
			</section>

			<section className="flex items-center justify-between">
				<div>
					<div className="font-medium text-white/80">Low power mode</div>
					<div className="text-xs text-white/50">Reduce visual intensity and rate</div>
				</div>
				<label className="inline-flex items-center gap-2">
					<input type="checkbox" checked={!!lowPowerMode} onChange={e=>setLowPowerMode(e.target.checked)} />
				</label>
			</section>

			<section className="flex items-center justify-between">
				<div>
					<div className="font-medium text-white/80">Beat gating</div>
					<div className="text-xs text-white/50">Gate onset-driven effects (B)</div>
				</div>
				<label className="inline-flex items-center gap-2">
					<input type="checkbox" checked={!!beatGateEnabled} onChange={toggleBeatGate} />
				</label>
			</section>
		</div>
	)
}