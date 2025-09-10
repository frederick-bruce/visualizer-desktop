import { useEffect, useState, useRef, useCallback } from 'react'
import { Player as API, Me } from '@/lib/spotifyApi'
import { usePlayerStore } from '@/store/player'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, ListMusic } from 'lucide-react'
import { useSpotifyPlayer } from '@/lib/useSpotifyPlayer'
import { clamp } from '@/lib/time'
import { Button } from './ui/Button'
import { deriveAccentFromArt } from '@/lib/theme'

export default function PlayerBar() {
	useSpotifyPlayer()
	const { isAuthed, isPlaying, volume, setVolume, mute, unmute, login, authError, setAuthError, deviceId } = usePlayerStore()
	const storeGet = usePlayerStore.getState
	const [pos, setPos] = useState(0)
	const [dur, setDur] = useState(0)
	const [buffered, setBuffered] = useState(0)
	const [showQueue, setShowQueue] = useState(false)
	const [showDevices, setShowDevices] = useState(false)
	const [devices, setDevices] = useState<any[]>([])
	const [loadingDevices, setLoadingDevices] = useState(false)
	const dragging = useRef(false)
	const dragPos = useRef(0)
	const barRef = useRef<HTMLDivElement | null>(null)
	const queueRef = useRef<HTMLDivElement | null>(null)
	const devicesRef = useRef<HTMLDivElement | null>(null)

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

	// Device loader
	const loadDevices = useCallback(async () => {
		if (!isAuthed) return
		setLoadingDevices(true)
		try {
			const list = await Me.devices() as any
			setDevices(list?.devices || [])
			if (!list?.devices?.length) {
				// no devices
			} else {
				setAuthError(null)
			}
		} catch (err: any) {
			setAuthError('Device fetch failed')
		} finally {
			setLoadingDevices(false)
		}
	}, [isAuthed, setAuthError])

	useEffect(() => {
		if (!isAuthed) return
		loadDevices()
		const id = setInterval(loadDevices, 15000)
		return () => clearInterval(id)
	}, [isAuthed, loadDevices])

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
			{!isAuthed && (
				<div className="absolute -top-7 left-0 right-0 h-7 flex items-center gap-3 px-3 text-[11px] bg-gradient-to-r from-emerald-500/20 via-emerald-400/15 to-emerald-500/20 border border-emerald-400/30 rounded-t-lg backdrop-blur-sm">
					<span className="font-medium text-emerald-200 tracking-wide">Not connected</span>
					<button onClick={() => login()} className="px-2 py-0.5 rounded bg-emerald-500/30 hover:bg-emerald-500/50 text-emerald-50 text-[11px] font-medium transition-colors">Connect Spotify</button>
					{authError && <span className="text-red-300">{authError}</span>}
				</div>
			)}
			{!isAuthed ? (
				<div className="text-white/60 flex items-center gap-3">
					<span>Sign in to control playback.</span>
					<button onClick={() => login()} className="px-3 py-1 rounded bg-emerald-500/30 hover:bg-emerald-500/50 text-emerald-50 text-sm font-medium transition-colors">Connect</button>
				</div>
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
						<div ref={devicesRef} className="relative">
							<button onClick={() => { setShowDevices(s => !s); if (!showDevices) loadDevices() }} className="px-2 py-1 text-[11px] rounded-md border border-white/10 hover:border-white/25 text-white/60 hover:text-white/90 transition-colors">Devices</button>
							{showDevices && (
								<div className="absolute right-0 top-full mt-2 w-64 bg-neutral-900/95 backdrop-blur-md border border-white/10 rounded-lg shadow-xl p-2 flex flex-col gap-1 text-xs z-50">
									<div className="flex items-center justify-between mb-1">
										<span className="font-semibold text-white/80">Devices</span>
										<button className="text-white/40 hover:text-white/70 text-[10px]" onClick={() => setShowDevices(false)}>Close</button>
									</div>
									{loadingDevices && <div className="animate-pulse text-white/50 py-2">Loading…</div>}
									{!loadingDevices && !devices.length && <div className="text-white/40 py-2">No devices found. Open Spotify on another device.</div>}
									{devices.map(d => (
										<button key={d.id} onClick={async () => { await API.transfer(d.id); loadDevices(); }} className={`flex items-center justify-between px-2 py-1 rounded hover:bg-white/5 text-left ${d.is_active ? 'bg-emerald-500/20 text-emerald-200' : 'text-white/70'}`}>
											<span className="truncate max-w-[140px]">{d.name || 'Unnamed'}</span>
											<span className="text-[10px] opacity-70">{d.type}</span>
										</button>
									))}
								</div>
							)}
						</div>
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
			{showDevices && (
				// overlay click catcher (optional future)
				<div />
			)}
		</div>
	)
}