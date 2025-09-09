import VisualizerCanvas from '@/components/VisualizerCanvas'
import { usePlayerStore } from '@/store/player'
import { Button, Card } from '@/components/ui'
import { useEffect, useState } from 'react'


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
	return (
		<div className="h-full w-full flex items-center justify-center p-6">
					{isAuthed ? (
						<div className="w-full h-full flex items-stretch justify-center">
							<div className="w-full max-w-[1200px] grid grid-cols-1 md:grid-cols-[minmax(220px,280px)_1fr] gap-6 items-start">
								{/* Album card column (stacks above on mobile) */}
								<div>
									<div className="album-card rounded-2xl overflow-hidden">
										<div className="relative">
											<img src={art ?? ''} alt={title ?? 'Album art'} className="w-full h-auto block" />
											<div className="album-reflection" />
										</div>
									</div>
												<div className="mt-3 space-y-1">
													<div className="typo-h1 marquee">
														<span className="marquee-inner" title={title ?? undefined}>{title ?? '—'}</span>
													</div>
													<div className="typo-body marquee">
														<span className="marquee-inner" title={artists ?? undefined}>{artists ?? '—'}</span>
													</div>
												</div>
								</div>

								{/* Visualizer column */}
								<div className="min-h-0 flex">
									<div className="aspect-4-5 md:aspect-16-9 w-full h-full rounded-2xl overflow-hidden">
										<VisualizerCanvas />
									</div>
								</div>
							</div>
						</div>
					) : (
				<div className="text-center space-y-6 max-w-lg">
					<h1 className="text-4xl font-extrabold">Spotify Visualizer</h1>
					<p className="text-white/60">Connect your Spotify account to start the show. Choose a playlist from the left and press play, or let the player control the experience.</p>
					<Card className="inline-block">
						<Button onClick={login} className="px-6 py-3 text-lg">Connect with Spotify</Button>
					</Card>
					{authError && (
						<div className="text-sm text-red-400 mt-2">{authError}</div>
					)}
				</div>
			)}
		</div>
	)
}