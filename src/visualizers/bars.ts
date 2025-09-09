import type { Visualizer, VizCtx } from './types'


export const bars: Visualizer = (vc?: VizCtx) => {
	if (!vc) return
	const { ctx, width, height, intensity, time } = vc
	if (!ctx) return
	ctx.clearRect(0, 0, width, height)
const n = 48
const gap = 4
const w = (width - gap * (n - 1)) / n
for (let i = 0; i < n; i++) {
const f = i / n
const h = (0.15 + 0.85 * Math.abs(Math.sin(time * (1.5 + f * 3)))) * intensity
const bh = h * (height * 0.8)
const x = i * (w + gap)
const y = height - bh
ctx.fillStyle = `rgba(29,185,84,${0.5 + 0.5 * f})` // accent gradient
ctx.fillRect(x, y, w, bh)
}
}