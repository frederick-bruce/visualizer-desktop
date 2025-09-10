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
