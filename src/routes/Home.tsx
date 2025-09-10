import VisualizerCanvas from '@/components/VisualizerCanvas'
import { usePlayerStore } from '@/store/player'
import { Button, Card } from '@/components/ui'
import { useEffect, useMemo, useState } from 'react'
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
		if (!isAuthed) return <AuthCallout />
		return (
			<div className="w-full h-full flex items-stretch justify-center">
				<div className="w-full max-w-[1200px] grid grid-cols-1 md:grid-cols-[minmax(220px,280px)_1fr] gap-6 items-start">
					<div>
						<div className="album-card rounded-2xl overflow-hidden">
							<div className="relative">
								<img src={art ?? ''} alt={title ?? 'Album art'} className="w-full h-auto block" />
								<div className="album-reflection" />
							</div>
						</div>
						<div className="mt-3 space-y-1">
							<div className="typo-h1 marquee"><span className="marquee-inner" title={title ?? undefined}>{title ?? '—'}</span></div>
							<div className="typo-body marquee"><span className="marquee-inner" title={artists ?? undefined}>{artists ?? '—'}</span></div>
						</div>
					</div>
					<div className="min-h-0 flex">
						<div className="aspect-4-5 md:aspect-16-9 w-full h-full rounded-2xl overflow-hidden">
							<VisualizerCanvas />
						</div>
					</div>
				</div>
			</div>
		)
	}

	function VisualizersPanel() {
		return (
			<div className="p-6 h-full w-full overflow-auto">
				<h2 className="text-lg font-semibold mb-4">Choose a visualizer</h2>
				<div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(140px,1fr))]">
					{vizList.map(v => <VisualizerCard key={v} name={v as any} />)}
				</div>
			</div>
		)
	}

	function SettingsPanel() {
			const { logout } = usePlayerStore()
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
				<div className="aspect-video w-full rounded-md bg-black/40 flex items-center justify-center text-xs uppercase tracking-wide text-white/70">
					{name}
				</div>
				<div className="mt-2 flex items-center justify-between text-sm">
					<span className="font-medium">{name}</span>
					{selected && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent,#1DB954)]/20 text-[var(--accent,#1DB954)]">Active</span>}
				</div>
			</button>
		)
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