
import type { Visualizer, VizCtx } from './types'


const MAX = 160
let parts: { x: number; y: number; vx: number; vy: number; life: number }[] = []


function ensure(width: number, height: number) {
if (parts.length >= MAX) return
for (let i = parts.length; i < MAX; i++) {
parts.push({ x: Math.random() * width, y: Math.random() * height, vx: 0, vy: 0, life: Math.random() * 1 })
}
}


export const particles: Visualizer = (vc?: VizCtx) => {
	if (!vc) return
	const { ctx, width, height, intensity, time, bandAverages } = vc
	if (!ctx) return
	ensure(width, height)
	ctx.fillStyle = 'rgba(0,0,0,0.2)'
	ctx.fillRect(0, 0, width, height) // motion blur
for (const p of parts) {
const ang = Math.sin((p.x + time * 60) * 0.002) * Math.PI
const bass = bandAverages ? bandAverages[0] : intensity
const spd = 0.4 + (intensity * 1.2) + bass * 1.2
p.vx += Math.cos(ang) * 0.05 * spd
p.vy += Math.sin(ang) * 0.05 * spd
p.x = (p.x + p.vx + width) % width
p.y = (p.y + p.vy + height) % height
p.vx *= 0.98
p.vy *= 0.98


ctx.fillStyle = 'rgba(29,185,84,0.9)'
ctx.beginPath();
ctx.arc(p.x, p.y, 2 + intensity * 2, 0, Math.PI * 2)
ctx.fill()
}
}