import { useEffect, useState, useRef } from 'react'
import { Player as API } from '@/lib/spotifyApi'
import { usePlayerStore } from '@/store/player'
import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react'
import { useSpotifyPlayer } from '@/lib/useSpotifyPlayer'
import { clamp } from '@/lib/time'
import { Button } from './ui/Button'
import { deriveAccentFromArt } from '@/lib/theme'


export default function PlayerBar() {
useSpotifyPlayer() // initialize SDK player


const { isAuthed, isPlaying, volume, setVolume } = usePlayerStore()
const storeGet = usePlayerStore.getState
const [pos, setPos] = useState(0)
const [dur, setDur] = useState(0)
const [title, setTitle] = useState<string | null>(null)
const [artists, setArtists] = useState<string | null>(null)
const [album, setAlbum] = useState<string | null>(null)
const [art, setArt] = useState<string | null>(null)
const progressRef = useRef<HTMLDivElement | null>(null)


// Poll current state for position/duration
useEffect(() => {
if (!isAuthed) return
const id = setInterval(async () => {
try {
const p = await fetch('https://api.spotify.com/v1/me/player', { headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` } })
if (!p.ok) return
const data = await p.json()
setPos(data.progress_ms || 0)
setDur(data.item?.duration_ms || 0)
// wire metadata
const it = data.item
if (it) {
	setTitle(it.name || null)
	setArtists((it.artists || []).map((a: any) => a.name).join(', ') || null)
	setAlbum(it.album?.name || null)
	const url = it.album?.images?.[0]?.url || null
	setArt(url)
	// derive dynamic accent from art
	deriveAccentFromArt(url)
} else {
	setTitle(null); setArtists(null); setAlbum(null); setArt(null)
}
const setter = storeGet().setIsPlaying
if (typeof setter === 'function') setter(data.is_playing)
} catch {}
}, 1000)
return () => clearInterval(id)
}, [isAuthed])


	const pct = dur ? (pos / dur) * 100 : 0

	const fmt = (ms: number) => {
		const s = Math.floor(ms / 1000)
		const m = Math.floor(s / 60)
		const sec = s % 60
		return `${m}:${sec.toString().padStart(2, '0')}`
	}


	return (
			<div className="w-full bg-card p-3 md:p-4 rounded-xl shadow-lg wmp-shell">
				{!isAuthed ? (
					<div className="text-white/60">Sign in to control playback</div>
				) : (
				<div className="flex flex-col items-stretch gap-4">
						{/* centered transport */}
						<div className="flex items-center justify-center gap-5">
										<Button
											variant="ghost"
											onClick={() => API.prev()}
											className="transport-btn btn-ghost-round rounded-full h-11 w-11 min-w-[44px] min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-dynamic)]"
								aria-label="Previous"
							>
								<SkipBack size={20} />
							</Button>
										<Button
											onClick={() => (isPlaying ? API.pause() : API.play())}
											className="transport-btn btn-primary-round rounded-full h-12 w-12 min-w-[48px] min-h-[48px] text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-dynamic)]"
								aria-label={isPlaying ? 'Pause' : 'Play'}
							>
								{isPlaying ? <Pause size={24} /> : <Play size={24} />}
							</Button>
										<Button
											variant="ghost"
											onClick={() => API.next()}
											className="transport-btn btn-ghost-round rounded-full h-11 w-11 min-w-[44px] min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-dynamic)]"
								aria-label="Next"
							>
								<SkipForward size={20} />
							</Button>
							{/* tiny loudness meter (proxy using volume) */}
							<div className="hidden md:flex items-center ml-2 h-3 w-16 bg-white/10 rounded">
								<div className="h-full bg-[var(--accent-dynamic)] rounded" style={{ width: `${Math.round(volume * 100)}%` }} />
							</div>
						</div>

						{/* progress with time at ends */}
									<div className="flex items-center gap-3">
										<div className="text-[11px] typo-num text-white/60 w-10 text-right">{fmt(pos)}</div>
							<input
								type="range"
								min={0}
								max={dur || 1}
								step={1000}
								value={pos}
								onChange={(e) => setPos(clamp(Number(e.target.value), 0, dur))}
								onMouseUp={(e) => API.seek(Number((e.target as HTMLInputElement).value)).catch(() => {})}
								onKeyUp={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										API.seek(pos).catch(() => {})
									}
								}}
								className="flex-1 progress-slider"
								aria-label="Progress"
							/>
							<div className="text-[11px] typo-num text-white/60 w-10">{fmt(dur)}</div>
						</div>
					</div>
				)}
			</div>
	)
}