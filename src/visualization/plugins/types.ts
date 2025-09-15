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
  }): void
  dispose(): void
}
