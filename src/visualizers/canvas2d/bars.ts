// This file adapted to export named procedural functions (init, render, resize, dispose)
// to match the simplified engine contract.

import { BeatFrame, VizSettings } from '../engine' // using public types re-exported in engine

interface BarState {
  canvas: HTMLCanvasElement | null
  ctx: CanvasRenderingContext2D | null
  width: number
  height: number
  dpr: number
  beatBoost: number
  emaLow: number
  emaMid: number
  emaHigh: number
}

const state: BarState = {
  canvas: null,
  ctx: null,
  width: 0,
  height: 0,
  dpr: 1,
  beatBoost: 0,
  emaLow: 0,
  emaMid: 0,
  emaHigh: 0
}

export function init(canvas: HTMLCanvasElement) {
  state.canvas = canvas
  state.ctx = canvas.getContext('2d')
}

export function resize(w: number, h: number, dpr: number, canvasOverride?: HTMLCanvasElement) {
  if (canvasOverride) state.canvas = canvasOverride
  state.width = w; state.height = h; state.dpr = dpr
  if (!state.canvas) return
  const cw = Math.max(1, Math.floor(w * dpr))
  const ch = Math.max(1, Math.floor(h * dpr))
  if (state.canvas.width !== cw || state.canvas.height !== ch) {
    state.canvas.width = cw
    state.canvas.height = ch
    state.canvas.style.width = w + 'px'
    state.canvas.style.height = h + 'px'
  }
}

export function render(frame: BeatFrame, settings: VizSettings, internalDt: number) {
  const { ctx, canvas, width, height, dpr } = state
  if (!ctx || !canvas) return
  // Use internal loop dt for EMA smoothing
  const alpha = 1 - Math.exp(-internalDt / 0.12)
  state.emaLow += (frame.energyLow - state.emaLow) * alpha
  state.emaMid += (frame.energyMid - state.emaMid) * alpha
  state.emaHigh += (frame.energyHigh - state.emaHigh) * alpha

  if (frame.isBeat) state.beatBoost = 1
  else state.beatBoost *= Math.exp(-internalDt / 0.2)

  const sens = settings.sensitivity
  const boost = 1 + state.beatBoost * 0.35 * sens

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0,0,width,height)

  const groups = [state.emaLow, state.emaMid, state.emaHigh]
  const colors: Record<VizSettings['colorMode'], string[]> = {
    spotify: ['#1DB954','#1ed760','#169c46'],
    neon: ['#ff007c','#34d2ff','#ffd400'],
    pastel: ['#a8d5ff','#ffc4e1','#d2f5b0']
  }
  const palette = colors[settings.colorMode]

  const totalBars = 48
  const barPad = 2
  const barWidth = (width - (totalBars-1)*barPad) / totalBars
  let x = 0
  for (let i=0;i<totalBars;i++) {
    const g = Math.floor(i / (totalBars/3))
    const base = groups[g]
    const v = base * (0.8 + 0.2*Math.sin(frame.time*2 + i*0.5))
    const bh = (height*0.6) * v * boost
    ctx.fillStyle = palette[g]
    ctx.fillRect(x, height - bh, barWidth, bh)
    x += barWidth + barPad
  }

  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  ctx.fillRect(0,0,width,10)
  ctx.globalCompositeOperation = 'source-over'
}

export function dispose() {
  state.canvas = null
  state.ctx = null
}

