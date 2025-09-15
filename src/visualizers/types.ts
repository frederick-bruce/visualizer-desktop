// Legacy 2D visualizer context (kept for backward compatibility during migration)
export type VizCtx = {
  ctx: CanvasRenderingContext2D | null
  width: number
  height: number
  time: number // seconds
  intensity: number // 0..~2
  bpm?: number
  bandAverages?: number[] // low -> high frequency energy 0..1
}

export type Visualizer = (vc: VizCtx) => void

// --- New pluggable engine types ---
export type RenderMode = 'canvas2d' | 'webgl'

export interface BeatFrame {
  time: number
  dt: number
  bpm: number
  progressMs: number
  isBeat: boolean
  energyLow: number
  energyMid: number
  energyHigh: number
}

export interface VizSettings {
  sensitivity: number
  colorMode: 'spotify' | 'neon' | 'pastel'
  particleCount: number
  postFX: boolean
}

export interface EngineVisualizer {
  init(container: HTMLElement): void
  update(frame: BeatFrame, settings: VizSettings): void
  resize(width: number, height: number, dpr: number): void
  dispose(): void
}

export interface VisualizerPreset {
  id: string
  name: string
  mode: RenderMode
  settings: Partial<VizSettings>
  variant?: 'particles' | 'shaderPlane' | 'bars'
}
