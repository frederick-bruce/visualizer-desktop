import { useEffect, useRef, useState } from 'react'
import { usePlayerStore } from '@/store/player'
import { Analysis } from '@/lib/spotifyApi'
import { buildTimeline, intensityAt } from '@/lib/beatmap'
import { useRafLoop } from '@/hooks/useRafLoop'
import * as V from '@/visualizers'


export default function VisualizerCanvas() {
const canvasRef = useRef<HTMLCanvasElement | null>(null)
const { visualizer } = usePlayerStore()
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


useRafLoop((dt) => {
	const c = canvasRef.current
	if (!c || !viz) return
	const ctx = c.getContext('2d')
	if (!ctx) return

	// handle CSS -> pixel backing store sizing for crisp rendering on HiDPI screens
	const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
	const cssWidth = c.clientWidth || 0
	const cssHeight = c.clientHeight || 0
	const pixelWidth = Math.max(1, Math.floor(cssWidth * dpr))
	const pixelHeight = Math.max(1, Math.floor(cssHeight * dpr))
	if (c.width !== pixelWidth || c.height !== pixelHeight) {
		// reset transform before resizing to avoid cumulative scaling
		ctx.setTransform(1, 0, 0, 1, 0, 0)
		c.width = pixelWidth
		c.height = pixelHeight
		// scale the drawing context so canvas drawing coordinates match CSS pixels
		if (dpr !== 1) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
	}

	timeRef.current += dt
	const tl = timelineRef.current
	const intensity = tl ? intensityAt(tl, timeRef.current) : 0.6

	// pass CSS coordinate width/height to visualizers (context is scaled to match)
	viz({ ctx, width: cssWidth, height: cssHeight, time: timeRef.current, intensity })
})


return <canvas ref={canvasRef} className="h-full w-full rounded-xl bg-black/60" />
}