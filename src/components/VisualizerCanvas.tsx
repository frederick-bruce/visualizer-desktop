import { useCallback, useEffect, useRef, useState } from 'react'
import { usePlayerStore } from '@/store/player'
import { Analysis } from '@/lib/spotifyApi'
import { buildTimeline, intensityAt, bpmAt, computeBandAverages } from '@/lib/beatmap'
import * as V from '@/visualizers'

// Simple shared RAF clock so multiple components can subscribe without duplicating RAF cost.
const subscribers: Set<(t: number, dt: number) => void> = new Set()
let rafRunning = false
let lastTs = performance.now()
function ensureRafLoop() {
	if (rafRunning) return
	rafRunning = true
	function loop(ts: number) {
		const dt = (ts - lastTs) / 1000
		lastTs = ts
		subscribers.forEach(fn => fn(ts, dt))
		if (subscribers.size === 0) { rafRunning = false; return }
		requestAnimationFrame(loop)
	}
	requestAnimationFrame(loop)
}

function subscribe(fn: (t: number, dt: number) => void) {
	subscribers.add(fn); ensureRafLoop(); return () => { subscribers.delete(fn) }
}


export default function VisualizerCanvas() {
const canvasRef = useRef<HTMLCanvasElement | null>(null)
const { visualizer, renderMode, setRenderMode, lowPowerMode, isLowEnd, styleMode } = usePlayerStore() as any
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
	const t = setInterval(load, 8000)
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
// Rendering logic with shared RAF clock + optional interval for "max" mode
useEffect(() => {
	const c = canvasRef.current
	const ctx = c?.getContext('2d') || null
	if (!c || !ctx) return

	let stopped = false
	let lastStepped = performance.now()
	let intervalId: any = null

	function renderTick(ts: number, dt: number) {
		if (stopped) return
		if (renderMode === 'raf') {
			step(dt)
		}
	}

		function step(dt: number) {
		if (!c || !ctx) return
		resize()
		// In low power mode, clamp dt to avoid large jumps and optionally drop frames
		const maxDt = 0.05
		if (dt > maxDt) dt = maxDt
		timeRef.current += dt
		const tl = timelineRef.current
		const intensityBase = tl ? intensityAt(tl, timeRef.current) : 0.6
		const sensitivity = usePlayerStore.getState().vizSettings?.sensitivity ?? 1
		let intensity = intensityBase * sensitivity
		const bpm = tl ? bpmAt(tl, timeRef.current) : undefined
		const bandAverages = computeBandAverages(timeRef.current, 8)

		// Low power adjustments: reduce intensity variance slightly & skip every other frame for particles
		if (lowPowerMode || isLowEnd) {
			if (viz === V.particles && (Math.floor(timeRef.current * 60) % 2 === 0)) {
				// skip rendering some frames for heavy viz
			}
			intensity *= 0.9
		}

		// Trail / blur future: if low power, ignore blur/trail heavy operations (not yet implemented in visuals)
			if (styleMode === 'nostalgia' && !(lowPowerMode || isLowEnd)) {
				// Draw to offscreen for bloom effect
				const ow = c.clientWidth
				const oh = c.clientHeight
				const off = (step as any)._off || ((step as any)._off = document.createElement('canvas'))
				off.width = ow
				off.height = oh
				const octx = off.getContext('2d')!
				octx.clearRect(0,0,ow,oh)
				viz({ ctx: octx, width: ow, height: oh, time: timeRef.current, intensity, bpm, bandAverages })
				// Copy base
				ctx.clearRect(0,0,ow,oh)
				ctx.drawImage(off,0,0)
				// Bloom pass: simple multi blur composite (cheap)
				ctx.save()
				ctx.globalCompositeOperation = 'lighter'
				const passes = 3
				for (let i=1;i<=passes;i++) {
					const scale = 1 + i*0.02
					ctx.globalAlpha = 0.10
					ctx.filter = `blur(${2*i}px)`
					ctx.drawImage(off, (ow - ow*scale)/2, (oh - oh*scale)/2, ow*scale, oh*scale)
				}
				ctx.restore()
				ctx.filter = 'none'
				// Reflection: draw flipped faded
				const rh = Math.min(oh * 0.25, 180)
				ctx.save()
				ctx.scale(1, -1)
				ctx.drawImage(off, 0, -oh - rh, ow, rh)
				ctx.restore()
				// Fade mask for reflection
				const grad = ctx.createLinearGradient(0, oh, 0, oh - rh)
				grad.addColorStop(0, 'rgba(0,0,0,0.6)')
				grad.addColorStop(1, 'rgba(0,0,0,1)')
				ctx.fillStyle = grad
				ctx.fillRect(0, oh - rh, ow, rh)
			} else {
				viz({ ctx, width: c.clientWidth, height: c.clientHeight, time: timeRef.current, intensity, bpm, bandAverages })
			}
	}

	let unsub: (() => void) | null = null
	if (renderMode === 'raf') {
		unsub = subscribe(renderTick)
	} else {
		// max mode: higher interval (adaptive). Lower if low power.
		const fps = (lowPowerMode || isLowEnd) ? 60 : 90
		intervalId = setInterval(() => {
			const now = performance.now()
			const dt = (now - lastStepped) / 1000
			lastStepped = now
			step(dt)
		}, 1000 / fps)
	}

	return () => {
		stopped = true
		if (unsub) unsub()
		if (intervalId) clearInterval(intervalId)
	}
}, [renderMode, viz, resize, lowPowerMode, isLowEnd, styleMode])

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