import React, { useEffect, useRef, useState } from 'react'
import { usePlayerStore } from '@/store/player'
import { clamp, formatTime } from '@/lib/time'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react'
import Tooltip from '@/components/ui/Tooltip'
import { transferPlayback } from '@/lib/spotifyClient'

// Minimal device API helpers (could be moved to typed client later)
async function fetchDevices(token: string) {
	const r = await fetch('https://api.spotify.com/v1/me/player/devices', { headers: { Authorization: `Bearer ${token}` } })
	if (!r.ok) throw new Error('device list failed')
	return r.json()
}

// legacy helper removed; using transferPlayback

export default function PlayerBar() {
	const store = usePlayerStore()
	const { isAuthed, isPlaying, volume, setVolume, mute, unmute, login, authError, play, pause, next, prev, seek, deviceId } = store as any
	const { progressMs, durationMs, bufferedMs, setFromSdk } = store as any

	// Smooth playback progress interpolation (local-only; no store writes)
	const baselineRef = useRef<{ base: number; at: number }>({ base: progressMs ?? 0, at: performance.now() })
	const [tick, setTick] = useState(0)
	// Re-baseline when store progress or play/pause changes
	useEffect(() => {
		baselineRef.current = { base: progressMs ?? 0, at: performance.now() }
	}, [progressMs, isPlaying])
	// Lightweight timer only while playing to trigger re-render
	useEffect(() => {
		if (!isPlaying) return
		const TICK_MS = 200
		const id = setInterval(() => setTick(t => (t + 1) % 1_000_000), TICK_MS)
		return () => clearInterval(id)
	}, [isPlaying])

	// Optimistic scrubbing state (local only while dragging / after a key seek until we reconcile)
	const [optimisticPos, setOptimisticPos] = useState<number | null>(null)
	const [dragging, setDragging] = useState(false)
	const trackBarRef = useRef<HTMLDivElement | null>(null)
	const hoverRef = useRef<HTMLDivElement | null>(null)
	const [hoverTime, setHoverTime] = useState<number | null>(null)
	// Removed duplicate devices UI; single DevicePicker in header is the only source of truth
	// Current displayed position: prefer optimistic while dragging, else interpolated progress
	const interpolated = (() => {
		if (!isPlaying) return progressMs ?? 0
		const { base, at } = baselineRef.current
		const delta = Math.max(0, performance.now() - at)
		return base + delta
	})()
	const liveProgress = optimisticPos != null ? optimisticPos : interpolated

	// When store progress catches up after a seek we clear optimistic state
	useEffect(() => {
		if (optimisticPos == null) return
		if (progressMs == null) return
		const drift = Math.abs(progressMs - optimisticPos)
		if (drift < 150) {
			setOptimisticPos(null)
		}
	}, [progressMs, optimisticPos])

	// Scrub logic
	const pos = Math.min(liveProgress, durationMs ?? liveProgress)
	const dur = durationMs ?? 0
	const buffered = Math.min(bufferedMs ?? 0, dur || Infinity)
	const pct = dur ? pos / dur : 0
	const bufPct = dur ? buffered / dur : 0

	const updateFromClientX = (clientX: number) => {
		if (!trackBarRef.current || !dur) return
		const rect = trackBarRef.current.getBoundingClientRect()
		const x = clamp(clientX - rect.left, 0, rect.width)
		const ratio = rect.width ? x / rect.width : 0
		const newMs = ratio * dur
		setOptimisticPos(newMs)
	}

	const onPointerDown = (e: React.PointerEvent) => {
		if (!isAuthed) return
		setDragging(true)
		updateFromClientX(e.clientX)
		trackBarRef.current?.setPointerCapture(e.pointerId)
	}
	const onPointerMove = (e: React.PointerEvent) => { if (dragging) updateFromClientX(e.clientX) }
	const onPointerUp = async () => {
		if (!dragging) return
		setDragging(false)
		if (optimisticPos != null) {
			const target = clamp(optimisticPos, 0, durationMs || optimisticPos)
			try {
				await seek(Math.floor(target))
				// Baseline the store so global tick continues smoothly
				if (durationMs != null) setFromSdk({ isPlaying, progressMs: target, durationMs })
			} catch { /* ignore */ }
		}
	}

	// Hover time tooltip
	const onMouseMove = (e: React.MouseEvent) => {
		if (!trackBarRef.current || !dur) { setHoverTime(null); return }
		const rect = trackBarRef.current.getBoundingClientRect()
		const x = clamp(e.clientX - rect.left, 0, rect.width)
		const ratio = rect.width ? x / rect.width : 0
		setHoverTime(ratio * dur)
		if (hoverRef.current) {
			const hw = 44
			let left = rect.left + x - hw/2
			left = clamp(left, 4, window.innerWidth - hw - 4)
			hoverRef.current.style.left = left + 'px'
		}
	}
	const clearHover = () => setHoverTime(null)

	// Keyboard controls (timeline focus)
	const onTimelineKey = (e: React.KeyboardEvent) => {
		if (!dur) return
		let delta = 0
		if (e.key === 'ArrowLeft') delta = -5000
		else if (e.key === 'ArrowRight') delta = 5000
		else if (e.key.toLowerCase() === 'j') delta = -10000
		else if (e.key.toLowerCase() === 'l') delta = 10000
		else if (e.key === 'Home') { e.preventDefault(); setOptimisticPos(0); seek(0); setFromSdk({ isPlaying, progressMs: 0, durationMs: dur }); return }
		else if (e.key === 'End') { e.preventDefault(); setOptimisticPos(dur); seek(dur); setFromSdk({ isPlaying, progressMs: dur, durationMs: dur }); return }
		if (delta) {
			e.preventDefault()
			const target = clamp(pos + delta, 0, dur)
			setOptimisticPos(target)
			seek(target).then(() => { setFromSdk({ isPlaying, progressMs: target, durationMs: dur }) }).catch(()=>{})
		}
	}

	// Global volume & mute keys
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if ((e.target as HTMLElement)?.closest('input,textarea,[contenteditable="true"]')) return
			if (e.key.toLowerCase() === 'm') { e.preventDefault(); volume === 0 ? unmute() : mute() }
			else if (e.key === 'ArrowUp') { e.preventDefault(); setVolume(clamp(volume + 0.05, 0, 1)) }
			else if (e.key === 'ArrowDown') { e.preventDefault(); setVolume(clamp(volume - 0.05, 0, 1)) }
		}
		window.addEventListener('keydown', handler)
		return () => window.removeEventListener('keydown', handler)
	}, [volume, mute, unmute, setVolume])

	// Devices popover
	// Devices UI removed from PlayerBar

	const disabled = !isAuthed

	// Device status
	const { sdkDeviceId, activeDeviceId } = store as any
	const anyActiveDevice = !!activeDeviceId
	const sdkKnown = !!sdkDeviceId
	const sdkActive = anyActiveDevice && sdkDeviceId && activeDeviceId === sdkDeviceId
	// All device status messaging is centralized in the header; remove extra banners here
	const showActivateButton = isAuthed && sdkKnown && !sdkActive

	const transportBtn = (icon: React.ReactElement, label: string, onClick: ()=>void, props: any={}) => (
		<Tooltip label={disabled ? `${label} (unavailable)` : label}>
			<button
				type="button"
				aria-label={label}
				disabled={disabled}
				onClick={onClick}
				className="h-10 w-10 md:h-11 md:w-11 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-white/5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent,#1DB954)]"
				data-testid={`control-${label.toLowerCase()}`}
				{...props}
			>{icon}</button>
		</Tooltip>
	)

	return (
		<div className="w-full h-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm px-4 md:px-6 py-2 md:py-3 flex flex-col gap-2 select-none text-white">
			{!isAuthed && (
				<div className="text-[11px] mb-1 text-amber-300/80 flex gap-2 items-center">
					<span>Not connected.</span>
					<button onClick={login} className="underline hover:text-amber-200">Connect</button>
					{authError && <span className="text-red-400">{authError}</span>}
				</div>
			)}
			<div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-6 w-full">
				{/* Now Playing cluster (art + title/artist) */}
				<div className="flex items-center gap-3 min-w-0 order-1">
					<div className="w-10 h-10 rounded-md overflow-hidden bg-white/10 flex items-center justify-center">
						{(store.track as any)?.albumArt ? (
							<img src={(store.track as any).albumArt} alt={(store.track as any)?.name || 'album art'} className="w-full h-full object-cover" />
						) : (
							<div className="text-[10px] text-white/40">—</div>
						)}
					</div>
					<div className="flex flex-col min-w-0">
						<div className="text-[12px] leading-tight truncate">{(store.track as any)?.name || '—'}</div>
						<div className="text-[11px] leading-tight text-white/60 truncate">{(store.track as any)?.artists || ''}</div>
					</div>
				</div>
						{/* Device status banner removed (header shows a single source of truth) */}
				{/* Left cluster */}
				<div className="flex items-center gap-3 md:gap-4 order-1">
					{transportBtn(<SkipBack size={18} />, 'Previous', () => prev())}
					{transportBtn(isPlaying ? <Pause size={22}/> : <Play size={22}/> , isPlaying ? 'Pause' : 'Play', () => (isPlaying ? pause() : play()))}
					{transportBtn(<SkipForward size={18} />, 'Next', () => next())}
				</div>
				{/* Center timeline */}
				<div className="flex-1 order-3 md:order-2 flex flex-col gap-1 min-w-[200px]">
					<div className="flex md:hidden justify-between text-[10px] font-mono text-white/60">
						<span>{formatTime(pos)}</span>
						<span>{formatTime(dur)}</span>
					</div>
					<div
						role="slider"
						aria-label="Playback position"
						aria-valuemin={0}
						aria-valuemax={dur || 0}
						aria-valuenow={Math.floor(pos) || 0}
						tabIndex={0}
						onKeyDown={onTimelineKey}
						ref={trackBarRef}
						onPointerDown={onPointerDown}
						onPointerMove={onPointerMove}
						onPointerUp={onPointerUp}
						onMouseMove={onMouseMove}
						onMouseLeave={clearHover}
						className={"relative h-6 flex items-center cursor-pointer group outline-none" + (disabled ? ' opacity-40 cursor-not-allowed' : '')}
						data-testid="timeline-slider"
					>
						<div className="w-full h-2 rounded-full bg-white/10 overflow-hidden relative">
							<div className="absolute inset-y-0 left-0 bg-white/15" style={{ width: `${bufPct*100}%` }} />
							<div className="absolute inset-y-0 left-0 bg-[var(--accent,#1DB954)]" style={{ width: `${pct*100}%` }} />
							<div className="absolute top-1/2 -translate-y-1/2 h-3 w-3 md:h-4 md:w-4 rounded-full bg-white shadow ring-2 ring-black/30 translate-x-[-50%] transition-transform duration-75 will-change-transform" style={{ left: `${pct*100}%` }} />
						</div>
					</div>
					<div className="hidden md:flex justify-between text-[11px] font-mono text-white/60 leading-none">
						<span>{formatTime(pos)}</span>
						<span>{formatTime(dur)}</span>
					</div>
					{hoverTime != null && (
						<div ref={hoverRef} className="pointer-events-none fixed bottom-[calc(72px+54px)] md:bottom-[calc(72px+40px)] translate-y-[-4px] px-2 py-1 rounded bg-black/80 border border-white/10 text-[11px] font-mono text-white/90 shadow-lg z-[60]">
							{formatTime(hoverTime)}
						</div>
					)}
				</div>
				{/* Right cluster */}
				<div className="flex items-center gap-3 md:gap-4 order-2 md:order-3 ml-auto">
					{/* Activate device if not active */}
					{showActivateButton && (
						<Tooltip label="Make this app the active device">
							<button
								onClick={async () => { try { if ((store as any).sdkDeviceId) { await transferPlayback({ deviceId: (store as any).sdkDeviceId, play: isPlaying }); (store as any).refreshDevices() } } catch {} }}
								className="px-2 h-9 rounded-md text-[12px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30"
							>
								Activate This App
							</button>
						</Tooltip>
					)}
					{/* Volume */}
					<Tooltip label={volume === 0 ? 'Unmute (M)' : 'Mute (M)'}>
						<button
							aria-label={volume === 0 ? 'Unmute' : 'Mute'}
							onClick={() => (volume === 0 ? unmute() : mute())}
							className="h-9 w-9 rounded-md flex items-center justify-center bg-white/5 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent,#1DB954)]"
						>{volume === 0 ? <VolumeX size={18}/> : <Volume2 size={18}/>}</button>
					</Tooltip>
					<input
						type="range" min={0} max={1} step={0.01}
						value={volume}
						onChange={e => setVolume(clamp(Number(e.target.value),0,1))}
						aria-label="Volume"
						className="w-24 md:w-32 accent-[var(--accent,#1DB954)] h-2 cursor-pointer"
						data-testid="volume-slider"
					/>
					{/* Devices UI moved to Header DevicePicker */}
				</div>
			</div>
		</div>
	)
}