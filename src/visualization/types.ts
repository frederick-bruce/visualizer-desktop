/* Visualization Plugin System Types (WMP-style) */
import * as THREE from 'three'

// Audio frame provided to visualization plugins each render tick
export interface VisualizationAudioFrame {
  time: number            // seconds since start
  dt: number              // delta time seconds
  bpm: number | null      // detected or inferred BPM
  beat: boolean           // beat event this frame
  beatProgress: number    // 0-1 progress within current beat
  bands: { low: number; mid: number; high: number } // normalized energies
  fft: Float32Array       // frequency domain magnitudes (0..1 normalized)
  waveform: Float32Array  // time domain samples -1..1
  amplitude: number       // overall loudness (RMS or peak)
}

// Graphics contexts that a plugin may request/use
export interface ThreeGraphicsContext {
  kind: 'three'
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  canvas: HTMLCanvasElement
}

export interface Canvas2DGraphicsContext {
  kind: 'canvas2d'
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
}

export type VisualizationGraphicsContext = ThreeGraphicsContext | Canvas2DGraphicsContext

// Plugin metadata akin to COM registration info
export interface VisualizationPluginMeta {
  id: string               // unique identifier (folder name)
  name: string             // human-friendly name
  version: string
  author?: string
  description?: string
  kind: 'three' | 'canvas2d'
  capabilities?: string[]  // e.g., ['beat','fft','waveform']
}

// Standard plugin interface – analogous to a COM object implementing a known vtable
export interface IVisualizationPlugin {
  readonly meta: VisualizationPluginMeta
  initialize(graphics: VisualizationGraphicsContext): void | Promise<void>
  renderFrame(frame: VisualizationAudioFrame): void
  resize?(width: number, height: number, dpr: number): void
  shutdown(): void
}

// Factory export contract for a plugin module
export interface VisualizationPluginModule {
  createPlugin(): IVisualizationPlugin
  meta?: VisualizationPluginMeta // optional static meta duplication
}

export type PluginDiscoveryRecord = {
  path: string
  loader: () => Promise<VisualizationPluginModule>
}
