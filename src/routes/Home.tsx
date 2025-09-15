import VisualizerCanvas from '@/components/VisualizerCanvas'
import { usePlayerStore } from '@/store/player'
import { Button, Card } from '@/components/ui'
import { useEffect, useMemo, useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import * as visualizers from '@/visualizers'


export default function Home() {
	const { isAuthed, login } = usePlayerStore()
	const { authError } = usePlayerStore()
	const [title, setTitle] = useState<string | null>(null)
	const [artists, setArtists] = useState<string | null>(null)
	const [art, setArt] = useState<string | null>(null)

	// lightweight polling for current track meta for the album card
	useEffect(() => {
		if (!isAuthed) return
		let canceled = false
		const id = setInterval(async () => {
			try {
				const res = await fetch('https://api.spotify.com/v1/me/player', { headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` } })
				if (!res.ok) return
				const data = await res.json()
				const it = data?.item
				if (canceled) return
				if (it) {
					setTitle(it.name || null)
					setArtists((it.artists || []).map((a: any) => a.name).join(', ') || null)
					const url = it.album?.images?.[0]?.url || null
					setArt(url)
				} else {
					setTitle(null); setArtists(null); setArt(null)
				}
			} catch {}
		}, 1200)
		return () => { canceled = true; clearInterval(id) }
	}, [isAuthed])
	const [searchParams] = useSearchParams()
	const tab = (searchParams.get('tab') || 'library').toLowerCase()

	const vizList = useMemo(() => {
		return Object.keys(visualizers).filter(k => !k.startsWith('__') && k !== 'default')
	}, [])

	function LibraryPanel() {
		const { devices } = usePlayerStore() as any
		if (!isAuthed) return <AuthCallout />
		return (
			<div className="w-full h-full flex items-center justify-center relative">
				<div className="w-full h-full rounded-2xl overflow-hidden">
					<VisualizerCanvas />
				</div>
				{devices && !devices.length && (
					<div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm text-center px-6">
						<div className="text-sm font-medium mb-2 text-white/80">No active device</div>
						<p className="text-xs text-white/60 max-w-xs mb-3">Open Spotify on one of your devices and press play to start visualizing.</p>
						<a href="https://open.spotify.com/" target="_blank" className="px-3 py-1.5 rounded bg-[var(--accent,#1DB954)]/25 text-[var(--accent,#1DB954)] text-xs font-medium hover:bg-[var(--accent,#1DB954)]/35">Open Spotify</a>
					</div>
				)}
			</div>
		)
	}

		function VisualizersPanel() {
			return (
				<div className="p-6 h-full w-full overflow-auto flex flex-col gap-8">
					<section>
						<h2 className="text-lg font-semibold mb-3">Visualizer</h2>
						<div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
							{vizList.map(v => <VisualizerCard key={v} name={v as any} />)}
						</div>
					</section>
					<SettingsPanelViz />
					<PresetsPanel />
				</div>
			)
		}

	function SettingsPanel() {
			const { logout, lowPowerMode, setLowPowerMode, isLowEnd, reduceMotion, setReduceMotion, styleMode, setStyleMode } = usePlayerStore() as any
			return (
				<div className="p-6 space-y-6 h-full w-full overflow-auto">
					<section>
						<h2 className="text-lg font-semibold mb-2">Account</h2>
						{isAuthed ? (
							<div className="flex items-center gap-3">
								<Button onClick={logout}>Logout</Button>
							</div>
						) : <Button onClick={login}>Connect Spotify</Button> }
					</section>
					<section>
						<h2 className="text-lg font-semibold mb-2">Device</h2>
						<p className="text-sm text-white/60">Device selection coming soon.</p>
					</section>
					<section>
						<h2 className="text-lg font-semibold mb-2">Performance</h2>
						<label className="flex items-center gap-3 text-sm select-none cursor-pointer">
							<input type="checkbox" checked={lowPowerMode} onChange={e => setLowPowerMode(e.target.checked)} />
							<span>Low Power Mode</span>
						</label>
						<p className="text-xs text-white/50 mt-1 max-w-md">Reduces visual effects (blur/glow) and may lower frame pacing to save CPU/GPU. {isLowEnd && <span className="text-amber-300 ml-1">Auto‑recommended for this device.</span>}</p>
						<label className="flex items-center gap-3 text-sm select-none cursor-pointer mt-4">
							<input type="checkbox" checked={!!reduceMotion} onChange={e => setReduceMotion(e.target.checked)} />
							<span>Reduce Motion</span>
						</label>
						<p className="text-xs text-white/50 mt-1 max-w-md">Disables heavy animations & transitions. Respects system preference.</p>
					</section>
					<section>
						<h2 className="text-lg font-semibold mb-2">Style</h2>
						<div className="flex items-center gap-3 text-sm">
							<button onClick={() => setStyleMode('default')} className={[ 'px-3 py-1.5 rounded-md border text-xs', styleMode==='default' ? 'bg-white/15 border-white/30' : 'bg-white/5 border-white/10 hover:bg-white/10'].join(' ')}>Default</button>
							<button onClick={() => setStyleMode('nostalgia')} className={[ 'px-3 py-1.5 rounded-md border text-xs', styleMode==='nostalgia' ? 'bg-[var(--accent,#1DB954)]/30 border-[var(--accent,#1DB954)]/40' : 'bg-white/5 border-white/10 hover:bg-white/10'].join(' ')}>Nostalgia</button>
						</div>
						<p className="text-xs text-white/50 mt-1 max-w-md">Nostalgia adds subtle bloom and a classic equalizer reflection with minimal performance impact.</p>
					</section>
				</div>
			)
	}

	function AuthCallout() {
		return (
			<div className="text-center space-y-6 max-w-lg mx-auto py-12">
				<h1 className="text-4xl font-extrabold">Spotify Visualizer</h1>
				<p className="text-white/60">Connect your Spotify account to start the show. Choose a playlist from the left and press play, or let the player control the experience.</p>
				<Card className="inline-block"><Button onClick={login} className="px-6 py-3 text-lg">Connect with Spotify</Button></Card>
				{authError && <div className="text-sm text-red-400 mt-2">{authError}</div>}
			</div>
		)
	}

	function VisualizerCard({ name }: { name: keyof typeof visualizers }) {
			const { visualizer, setVisualizer } = usePlayerStore()
		const selected = visualizer === name
		return (
			<button
				onClick={() => setVisualizer(name as any)}
				className={["group relative flex flex-col items-stretch rounded-lg border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] transition", selected ? 'ring-1 ring-[var(--accent)]' : ''].join(' ')}
			>
					<LivePreview viz={name} />
				<div className="mt-2 flex items-center justify-between text-sm">
					<span className="font-medium">{name}</span>
					{selected && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent,#1DB954)]/20 text-[var(--accent,#1DB954)]">Active</span>}
				</div>
			</button>
		)
	}

		function SettingsPanelViz() {
			const { vizSettings, setVizSettings } = usePlayerStore()
			return (
				<section>
					<h2 className="text-lg font-semibold mb-3">Tuning</h2>
					<div className="space-y-4 max-w-md">
						<SliderField label="Sensitivity" value={vizSettings.sensitivity} min={0.5} max={2} step={0.05} onChange={v => setVizSettings({ sensitivity: v })} help="Boosts reaction to beats" />
						<SliderField label="Trail" value={vizSettings.trail} min={0} max={1} step={0.05} onChange={v => setVizSettings({ trail: v })} help="Persistence of previous frame" />
						<SliderField label="Color Var" value={vizSettings.colorVariance} min={0} max={1} step={0.05} onChange={v => setVizSettings({ colorVariance: v })} help="Hue variance (future)" />
						<SliderField label="Blur" value={vizSettings.blur} min={0} max={0.5} step={0.01} onChange={v => setVizSettings({ blur: v })} help="Soft glow (future)" />
					</div>
				</section>
			)
		}

		function PresetsPanel() {
			const { presets, createPreset, deletePreset, applyPreset, vizSettings, visualizer } = usePlayerStore()
			const [presetName, setPresetName] = useState('')
			return (
				<section>
					<h2 className="text-lg font-semibold mb-3">Presets</h2>
					<form className="flex gap-2 mb-4" onSubmit={e => { e.preventDefault(); if (presetName.trim()) { createPreset(presetName.trim()); setPresetName('') } }}>
						<input value={presetName} onChange={e => setPresetName(e.target.value)} placeholder="Preset name" className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
						<button type="submit" className="px-3 py-1.5 bg-[var(--accent,#1DB954)]/20 border border-[var(--accent,#1DB954)]/40 rounded text-sm">Create</button>
					</form>
					<div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
						{presets.map(p => {
							const active = p.visualizer === visualizer && JSON.stringify(p.settings) === JSON.stringify(vizSettings)
							return (
								<div key={p.id} className={["group relative rounded-md border border-white/10 bg-white/5 p-3", active ? 'ring-1 ring-[var(--accent)]' : ''].join(' ')}>
									<div className="text-sm font-medium mb-1 truncate" title={p.name}>{p.name}</div>
									<div className="text-[11px] text-white/50 mb-2">{p.visualizer}</div>
									<div className="flex gap-2">
										<button type="button" onClick={() => applyPreset(p.id)} className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/15">Apply</button>
										<button type="button" onClick={() => deletePreset(p.id)} className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30">Del</button>
									</div>
								</div>
							)
						})}
					</div>
				</section>
			)
		}

		function SliderField({ label, value, min, max, step, onChange, help }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; help?: string }) {
			return (
				<label className="flex flex-col gap-1 text-sm">
					<div className="flex items-center justify-between">
						<span>{label}</span>
						<span className="font-mono text-[11px] text-white/50">{value.toFixed(2)}</span>
					</div>
					<input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="w-full accent-[var(--accent,#1DB954)]" />
					{help && <div className="text-[11px] text-white/40">{help}</div>}
				</label>
			)
		}

		function LivePreview({ viz }: { viz: keyof typeof visualizers }) {
			const ref = useRef<HTMLCanvasElement | null>(null)
			useEffect(() => {
				const c = ref.current
				if (!c) return
				const ctx = c.getContext('2d')
				if (!ctx) return
				let t = 0
				let raf: number
				const render = () => {
					const w = c.width = 160
					const h = c.height = 90
					t += 0.016
					ctx.clearRect(0,0,w,h)
					const intensity = 0.6 + 0.4 * Math.sin(t * 2)
					const fn = (visualizers as any)[viz]
					if (fn) fn({ ctx, width: w, height: h, time: t, intensity })
					raf = requestAnimationFrame(render)
				}
				raf = requestAnimationFrame(render)
				return () => cancelAnimationFrame(raf)
			}, [viz])
			return <canvas ref={ref} className="aspect-video w-full rounded-md bg-black/40" />
		}

		let content: React.ReactNode
	if (tab === 'visualizers') content = <VisualizersPanel />
	else if (tab === 'settings') content = <SettingsPanel />
	else content = <LibraryPanel />

	return (
		<div className="h-full w-full flex items-stretch justify-stretch">
			{content}
		</div>
	)
}