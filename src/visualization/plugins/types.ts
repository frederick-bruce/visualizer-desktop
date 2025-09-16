import * as THREE from 'three'

export interface VisualizationPlugin {
  initialize(ctx: {
    container: HTMLElement
    renderer: THREE.WebGLRenderer
    scene: THREE.Scene
    camera: THREE.Camera
    analyser: AnalyserNode
    three: typeof THREE
  }): Promise<void> | void
  renderFrame(frame: {
    fft: Uint8Array
    waveform: Uint8Array
    dt: number
    time: number
    beat: boolean
    // Extended musical metadata (optional fields may be undefined if provider not available)
    bass?: number
    mid?: number
    treb?: number
    intensity?: number
    beatPhase?: number // 0..1 progress within current beat
    barPhase?: number  // 0..1 progress within current bar/measure
    bpm?: number
    chorus?: boolean // heuristic large-scale energy lift
  }): void
  dispose(): void
}
