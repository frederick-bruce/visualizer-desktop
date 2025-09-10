import type { Visualizer, VizCtx } from './types'


export const bars: Visualizer = (vc?: VizCtx) => {
	if (!vc) return
	const { ctx, width, height, intensity, time, bandAverages } = vc
	if (!ctx) return
	ctx.clearRect(0, 0, width, height)
const n = 48
const gap = 4
const w = (width - gap * (n - 1)) / n
for (let i = 0; i < n; i++) {
const f = i / n
const band = bandAverages ? bandAverages[Math.min(bandAverages.length - 1, Math.floor(f * bandAverages.length))] : intensity
const h = (0.12 + 0.9 * Math.max(intensity * 0.6, band)) * Math.abs(Math.sin(time * (1.5 + f * 3)))
const bh = h * (height * 0.8)
const x = i * (w + gap)
const y = height - bh
ctx.fillStyle = `rgba(29,185,84,${0.5 + 0.5 * f})` // accent gradient
ctx.fillRect(x, y, w, bh)
}
}