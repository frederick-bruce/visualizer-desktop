import { useEffect, useState, useRef, useCallback } from 'react'
import { Player as API } from '@/lib/spotifyApi'
import { usePlayerStore } from '@/store/player'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, ListMusic } from 'lucide-react'
import { useSpotifyPlayer } from '@/lib/useSpotifyPlayer'
import { clamp } from '@/lib/time'
import { Button } from './ui/Button'
import { deriveAccentFromArt } from '@/lib/theme'

export default function PlayerBar() {
	useSpotifyPlayer()
	const { isAuthed, isPlaying, volume, setVolume, mute, unmute } = usePlayerStore()
	const storeGet = usePlayerStore.getState
	const [pos, setPos] = useState(0)
	const [dur, setDur] = useState(0)
	const [buffered, setBuffered] = useState(0)
	const [showQueue, setShowQueue] = useState(false)
	const dragging = useRef(false)
	const dragPos = useRef(0)
	const barRef = useRef<HTMLDivElement | null>(null)
	const queueRef = useRef<HTMLDivElement | null>(null)

	// Poll playback state
	useEffect(() => {
		if (!isAuthed) return
		let cancelled = false
		const id = setInterval(async () => {
			try {
				const res = await fetch('https://api.spotify.com/v1/me/player', { headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` } })
				if (!res.ok) return
				const data = await res.json()
				if (cancelled) return
				if (!dragging.current) setPos(data.progress_ms || 0)
				setDur(data.item?.duration_ms || 0)
				setBuffered(Math.min((data.progress_ms || 0) + 15000, data.item?.duration_ms || 0))
				const it = data.item
				if (it) {
					const url = it.album?.images?.[0]?.url || null
					deriveAccentFromArt(url)
				}
				const setter = storeGet().setIsPlaying
				if (typeof setter === 'function') setter(data.is_playing)
			} catch {}
		}, 1000)
		return () => { cancelled = true; clearInterval(id) }
	}, [isAuthed])

	const pct = dur ? pos / dur * 100 : 0
	const bufPct = dur ? buffered / dur * 100 : 0

	const fmt = (ms: number) => {
		const s = Math.floor(ms / 1000)
		const m = Math.floor(s / 60)
		const sec = s % 60
		return `${m}:${sec.toString().padStart(2, '0')}`
	}

	const moveTo = (clientX: number) => {
		if (!barRef.current) return
		const rect = barRef.current.getBoundingClientRect()
		const x = clamp(clientX - rect.left, 0, rect.width)
		const ratio = rect.width ? x / rect.width : 0
		const newPos = ratio * dur
		dragPos.current = newPos
		setPos(newPos)
	}

	const onPointerDown = useCallback((e: React.PointerEvent) => {
		if (!barRef.current) return
		dragging.current = true
		barRef.current.setPointerCapture(e.pointerId)
		moveTo(e.clientX)
	}, [dur])

	useEffect(() => {
		const onMove = (e: PointerEvent) => { if (dragging.current) moveTo(e.clientX) }
		const onUp = () => { if (dragging.current) { dragging.current = false; API.seek(dragPos.current).catch(()=>{}) } }
		window.addEventListener('pointermove', onMove)
		window.addEventListener('pointerup', onUp)
		return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
	}, [dur])

	// Keyboard shortcuts
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement)?.contentEditable === 'true') return
			if (e.key === ' ') { e.preventDefault(); isPlaying ? API.pause() : API.play() }
			else if (e.key.toLowerCase() === 'm') { e.preventDefault(); volume > 0 ? mute() : unmute() }
			else if (e.key.toLowerCase() === 'j') { e.preventDefault(); API.seek(Math.max(0, pos - 10000)).catch(()=>{}) }
			else if (e.key.toLowerCase() === 'l') { e.preventDefault(); API.seek(Math.min(dur, pos + 10000)).catch(()=>{}) }
			else if (e.key === 'ArrowUp') { e.preventDefault(); setVolume(clamp(volume + 0.05, 0, 1)) }
			else if (e.key === 'ArrowDown') { e.preventDefault(); setVolume(clamp(volume - 0.05, 0, 1)) }
		}
		window.addEventListener('keydown', handler)
		return () => window.removeEventListener('keydown', handler)
	}, [isPlaying, volume, pos, dur, mute, unmute, setVolume])

	// Dismiss queue when clicking outside
	useEffect(() => {
		const onDoc = (e: MouseEvent) => {
			if (!queueRef.current) return
			if (!queueRef.current.contains(e.target as Node)) setShowQueue(false)
		}
		if (showQueue) document.addEventListener('mousedown', onDoc)
		return () => document.removeEventListener('mousedown', onDoc)
	}, [showQueue])

	return (
		<div className="w-full bg-card p-3 md:p-4 rounded-xl shadow-lg wmp-shell relative">
			{!isAuthed ? (
				<div className="text-white/60">Sign in to control playback</div>
			) : (
				<div className="flex flex-col gap-4">
					<div className="flex items-center justify-center gap-5">
						<Button variant="ghost" onClick={() => API.prev()} aria-label="Previous" className="h-11 w-11 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-dynamic)]"><SkipBack size={20} /></Button>
						<Button onClick={() => (isPlaying ? API.pause() : API.play())} aria-label={isPlaying ? 'Pause' : 'Play'} className="h-12 w-12 rounded-full text-white bg-white/10 hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-dynamic)]">{isPlaying ? <Pause size={24} /> : <Play size={24} />}</Button>
						<Button variant="ghost" onClick={() => API.next()} aria-label="Next" className="h-11 w-11 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-dynamic)]"><SkipForward size={20} /></Button>
						<div className="hidden md:flex items-center ml-2 h-3 w-16 bg-white/10 rounded">
							<div className="h-full bg-[var(--accent-dynamic)] rounded" style={{ width: `${Math.round(volume * 100)}%` }} />
						</div>
						<Button variant="ghost" aria-label="Queue" onClick={() => setShowQueue(s => !s)} className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-white/15"><ListMusic size={18} /></Button>
					</div>
					<div className="flex items-center gap-3">
						<div className="text-[11px] typo-num text-white/60 w-10 text-right">{fmt(pos)}</div>
						<div ref={barRef} className="flex-1 h-5 flex items-center cursor-pointer select-none" role="slider" aria-label="Progress" aria-valuemin={0} aria-valuemax={dur} aria-valuenow={pos} onPointerDown={onPointerDown}>
							<div className="relative w-full h-2 rounded-full bg-white/10 overflow-hidden">
								<div className="absolute inset-y-0 left-0 bg-white/20" style={{ width: `${bufPct}%` }} />
								<div className="absolute inset-y-0 left-0 bg-[var(--accent-dynamic)]" style={{ width: `${pct}%` }} />
								<div className="absolute -top-1 h-4 w-4 rounded-full bg-white shadow ring-2 ring-black/30 -translate-x-1/2" style={{ left: `${pct}%` }} />
							</div>
						</div>
						<div className="text-[11px] typo-num text-white/60 w-10">{fmt(dur)}</div>
					</div>
					<div className="flex items-center gap-2">
						<Button variant="ghost" aria-label={volume === 0 ? 'Unmute' : 'Mute'} onClick={() => (volume === 0 ? unmute() : mute())} className="h-9 w-9 rounded-md flex items-center justify-center hover:bg-white/15">{volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}</Button>
						<input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(clamp(Number(e.target.value), 0, 1))} aria-label="Volume" className="w-32 h-2 accent-[var(--accent-dynamic)] cursor-pointer" />
					</div>
				</div>
			)}
			{showQueue && (
				<div ref={queueRef} className="absolute bottom-full mb-2 right-4 w-64 rounded-lg border border-white/10 bg-black/70 backdrop-blur-md p-3 shadow-xl text-sm">
					<div className="font-semibold mb-2">Up Next</div>
					<ul className="space-y-1">
						{['Track A', 'Track B', 'Track C'].map(t => <li key={t} className="truncate opacity-80 hover:opacity-100">{t}</li>)}
					</ul>
				</div>
			)}
		</div>
	)
}