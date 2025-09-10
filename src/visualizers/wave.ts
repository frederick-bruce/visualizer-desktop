import type { Visualizer, VizCtx } from './types'


export const wave: Visualizer = (vc?: VizCtx) => {
	if (!vc) return
	const { ctx, width, height, intensity, time, bandAverages } = vc
	if (!ctx) return
	ctx.clearRect(0, 0, width, height)
	ctx.lineWidth = 2
	const glow = Math.min(1, intensity)
	ctx.strokeStyle = `rgba(255,255,255,${0.6 + 0.4 * glow})`
	ctx.beginPath()
const mid = height / 2
const bass = bandAverages ? bandAverages[0] : intensity
const amp = Math.min(height * 0.35, 120) * (0.4 + 0.6 * bass)
	for (let x = 0; x < width; x++) {
		const t = time + x * 0.005
		const y = mid + Math.sin(t * 2.1) * amp * 0.6 + Math.sin(t * 1.3) * amp * 0.4
		if (x === 0) {
			ctx.moveTo(x, y)
		} else {
			ctx.lineTo(x, y)
		}
	}
ctx.stroke()
}