import { useCallback, useEffect, useRef, useState } from 'react'
import { usePlayerStore } from '@/store/player'
import { Analysis } from '@/lib/spotifyApi'
import { buildTimeline, intensityAt, bpmAt, computeBandAverages } from '@/lib/beatmap'
import * as V from '@/visualizers'


export default function VisualizerCanvas() {
const canvasRef = useRef<HTMLCanvasElement | null>(null)
const { visualizer, renderMode, setRenderMode } = usePlayerStore()
const [viz, setViz] = useState<V.Visualizer>(() => V.bars)
const timelineRef = useRef<ReturnType<typeof buildTimeline> | null>(null)
const timeRef = useRef(0)


// Swap visualizer preset
useEffect(() => {
setViz(visualizer === 'bars' ? V.bars : visualizer === 'wave' ? V.wave : V.particles)
}, [visualizer])


// Track polling for current item + analysis
useEffect(() => {
let canceled = false
async function load() {
try {
const me = await fetch('https://api.spotify.com/v1/me/player/currently-playing', { headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` } })
if (!me.ok) return
const data = await me.json()
const id = data?.item?.id as string | undefined
if (!id) return
const analysis = await Analysis.audioAnalysis(id)
if (!canceled) timelineRef.current = buildTimeline(analysis)
} catch {}
}
load()
const t = setInterval(load, 5000)
return () => { canceled = true; clearInterval(t) }
}, [])


// Resize handling
const resize = useCallback(() => {
	const c = canvasRef.current
	if (!c) return
	const ctx = c.getContext('2d')
	if (!ctx) return
	const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
	const cssWidth = c.clientWidth || 0
	const cssHeight = c.clientHeight || 0
	const pixelWidth = Math.max(1, Math.floor(cssWidth * dpr))
	const pixelHeight = Math.max(1, Math.floor(cssHeight * dpr))
	if (c.width !== pixelWidth || c.height !== pixelHeight) {
		ctx.setTransform(1, 0, 0, 1, 0, 0)
		c.width = pixelWidth
		c.height = pixelHeight
		if (dpr !== 1) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
	}
}, [])

useEffect(() => {
	const obs = new ResizeObserver(() => resize())
	if (canvasRef.current) obs.observe(canvasRef.current)
	resize()
	return () => obs.disconnect()
}, [resize])

// Frame driver: RAF or setInterval
useEffect(() => {
	let stopped = false
	let last = performance.now()
	const c = canvasRef.current
	const ctx = c?.getContext('2d') || null
	if (!c || !ctx) return

	function frame(now: number) {
		if (stopped) return
		const dt = (now - last) / 1000
		last = now
		step(dt)
		rafId = requestAnimationFrame(frame)
	}

	function intervalTick() {
		const now = performance.now()
		const dt = (now - last) / 1000
		last = now
		step(dt)
	}

		function step(dt: number) {
			if (!c || !ctx) return
			resize()
			timeRef.current += dt
			const tl = timelineRef.current
			const intensityBase = tl ? intensityAt(tl, timeRef.current) : 0.6
			// pull sensitivity live each frame
			const sensitivity = usePlayerStore.getState().vizSettings?.sensitivity ?? 1
			const intensity = intensityBase * sensitivity
			const bpm = tl ? bpmAt(tl, timeRef.current) : undefined
			const bandAverages = computeBandAverages(timeRef.current, 8)
			viz({ ctx, width: c.clientWidth, height: c.clientHeight, time: timeRef.current, intensity, bpm, bandAverages })
		}

	let rafId: number | null = null
	let intervalId: any = null
	if (renderMode === 'raf') {
		rafId = requestAnimationFrame(frame)
	} else {
		intervalId = setInterval(intervalTick, 1000 / 90) // Max FPS ~90
	}
	return () => {
		stopped = true
		if (rafId) cancelAnimationFrame(rafId)
		if (intervalId) clearInterval(intervalId)
	}
}, [renderMode, viz, resize])

// Simple toggle UI (temporary until a settings control exists)
useEffect(() => {
	const handler = (e: KeyboardEvent) => {
		if (e.key === 'v' && (e.metaKey || e.ctrlKey)) {
			setRenderMode(renderMode === 'raf' ? 'max' : 'raf')
		}
	}
	window.addEventListener('keydown', handler)
	return () => window.removeEventListener('keydown', handler)
}, [setRenderMode])


return <canvas ref={canvasRef} data-render-mode={renderMode} className="h-full w-full rounded-xl bg-black/60" />
}