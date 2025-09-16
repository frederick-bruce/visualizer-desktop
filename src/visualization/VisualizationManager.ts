import * as THREE from 'three'
import { VisualizationPlugin } from './plugins/types'

export class VisualizationManager {
  private container: HTMLElement | null = null
  private analyser: AnalyserNode | null = null
  private renderer: THREE.WebGLRenderer | null = null
  private scene: THREE.Scene | null = null
  private camera: THREE.PerspectiveCamera | null = null
  private plugin: VisualizationPlugin | null = null
  private currentPluginId: string | null = null
  private animationHandle: number | null = null
  private lastTime = performance.now() / 1000
  private fftData: Uint8Array | null = null
  private waveData: Uint8Array | null = null
  private queuedPlugin: string | null = null
  private resizeObserver: ResizeObserver | null = null
  private energyProvider: (() => { low: number; mid: number; high: number; isBeat: boolean; bpm?: number; beatPhase?: number; barPhase?: number; intensity?: number; chorus?: boolean }) | null = null

  get activePluginId() { return this.currentPluginId }

  async initialize(container: HTMLElement, analyser: AnalyserNode): Promise<void> {
    this.container = container
    this.analyser = analyser
    // Core three setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    this.renderer.setClearColor(0x000000, 0)
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100)
    this.camera.position.set(0,0,5)
    const amb = new THREE.AmbientLight(0xffffff, 0.4); this.scene.add(amb)
    const dir = new THREE.DirectionalLight(0xffffff, 0.8); dir.position.set(3,5,4); this.scene.add(dir)
    container.appendChild(this.renderer.domElement)
    this.setupResize()
    this.resize()
    // Allocate audio buffers
    this.fftData = new Uint8Array(analyser.frequencyBinCount)
    this.waveData = new Uint8Array(analyser.fftSize)
    if (this.queuedPlugin) {
      const q = this.queuedPlugin; this.queuedPlugin = null; await this.loadPlugin(q)
    }
  }

  private setupResize() {
    if (!this.container) return
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(this.container)
    window.addEventListener('resize', this.onWindowResize)
  }
  private onWindowResize = () => this.resize()

  private resize() {
    if (!this.container || !this.renderer || !this.camera) return
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    this.camera.aspect = w / Math.max(1, h)
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
  }

  async loadPlugin(id: string): Promise<void> {
    if (id === this.currentPluginId) return
    if (!this.renderer || !this.scene || !this.camera || !this.analyser || !this.container) {
      this.queuedPlugin = id
      return
    }
    // Dispose existing
    if (this.plugin) {
      try { this.plugin.dispose() } catch {}
      // Clear scene children except lights (leave first two lights)
      this.scene.children.slice(2).forEach(c => this.scene!.remove(c))
    }
    // Dynamic import by id
    let mod: any
    try {
      mod = await this.dynamicImportPlugin(id)
    } catch (e) { console.error('[viz] failed to import plugin', id, e); return }
    const plugin: VisualizationPlugin = mod.default || mod[id] || mod.plugin || mod
    this.plugin = plugin
    this.currentPluginId = id
    await plugin.initialize({
      container: this.container,
      renderer: this.renderer,
      scene: this.scene,
      camera: this.camera,
      analyser: this.analyser,
      three: THREE
    })
    console.info('[viz] loaded plugin', id)
  }

  // External energy provider (e.g., beat engine) used when analyser has no real audio data.
  setEnergyProvider(fn: (() => { low: number; mid: number; high: number; isBeat: boolean; bpm?: number; beatPhase?: number; barPhase?: number; intensity?: number; chorus?: boolean }) | null) {
    this.energyProvider = fn
  }

  private async dynamicImportPlugin(id: string) {
    switch (id) {
      case 'musical-colors': return await import('./plugins/musical-colors')
      case 'wave-tunnel': return await import('./plugins/wave-tunnel')
      case 'particle-burst': return await import('./plugins/particle-burst')
      default: throw new Error('Unknown plugin ' + id)
    }
  }

  start() {
    if (this.animationHandle != null) return
    console.info('[viz] manager start')
    this.lastTime = performance.now() / 1000
    const loop = () => {
      this.animationHandle = requestAnimationFrame(loop)
      this.tick()
    }
    this.animationHandle = requestAnimationFrame(loop)
  }

  stop() {
    if (this.animationHandle != null) {
      cancelAnimationFrame(this.animationHandle)
      this.animationHandle = null
    }
  }

  private tick() {
    if (!this.plugin || !this.analyser || !this.renderer || !this.scene || !this.camera || !this.fftData || !this.waveData) return
    const now = performance.now() / 1000
    let dt = now - this.lastTime
    this.lastTime = now
    if (dt > 0.25) dt = 0.25
    // Pull audio data
    // Cast due to TypeScript lib mismatch between DOM lib versions in this environment
    this.analyser.getByteFrequencyData(this.fftData as any)
    this.analyser.getByteTimeDomainData(this.waveData as any)
    // If analyser not connected (all near silence) synthesize spectrum using external energy provider
    if (this.energyProvider) {
      let sum = 0
      for (let i=0;i<this.fftData.length;i++) sum += this.fftData[i]
      const avg = sum / this.fftData.length
      if (avg < 1) { // treat as silent/uninitialized
        const e = this.energyProvider()
        const L = e.low, M = e.mid, H = e.high
        const n = this.fftData.length
        const lEnd = (n * 0.18) | 0
        const mEnd = (n * 0.62) | 0
        for (let i=0;i<n;i++) {
          let base: number
            if (i < lEnd) base = L
            else if (i < mEnd) base = M
            else base = H
          // Add mild shaping + noise so bars vary
          const shape = Math.sin((i / n) * Math.PI) * 0.4 + 0.6
          const noise = (Math.random()*0.15 - 0.05)
          this.fftData[i] = Math.max(0, Math.min(255, (base * shape + noise) * 255))
        }
        // Waveform: simple centered sine modulated by mid energy & beat pulse
        for (let i=0;i<this.waveData.length;i++) {
          const tNorm = i / this.waveData.length
          const v = 0.5 + 0.5 * Math.sin(tNorm * Math.PI * 2 * (2 + M * 6)) * (0.3 + 0.7 * (M*0.7 + L*0.3))
          this.waveData[i] = Math.max(0, Math.min(255, v * 255))
        }
      }
    }
    // Simple beat heuristic: bass energy rising
    const bassBins = Math.max(1, (this.fftData.length * 0.08) | 0)
    let bassSum = 0
    for (let i=0;i<bassBins;i++) bassSum += this.fftData[i]
    const bassAvg = bassSum / bassBins / 255
    let beat = bassAvg > 0.55 // simplistic default
    if (this.energyProvider) {
      // If we synthesized (avg low) we already encoded energy; we can adopt external beat flag
      // Re-compute low avg quickly to detect silent input
      let total = 0; for (let i=0;i<this.fftData.length;i++) total += this.fftData[i]
      if (total / this.fftData.length < 1) {
        beat = this.energyProvider().isBeat
      }
    }
    // Extended band averages
    const midStart = (this.fftData.length * 0.1) | 0
    const midEnd = (this.fftData.length * 0.55) | 0
    let bassSum2 = 0, midSum2 = 0, trebSum2 = 0
    for (let i=0;i<midStart;i++) bassSum2 += this.fftData[i]
    for (let i=midStart;i<midEnd;i++) midSum2 += this.fftData[i]
    for (let i=midEnd;i<this.fftData.length;i++) trebSum2 += this.fftData[i]
    const bass = bassSum2 / Math.max(1, midStart) / 255
    const mid = midSum2 / Math.max(1, (midEnd-midStart)) / 255
    const treb = trebSum2 / Math.max(1, (this.fftData.length-midEnd)) / 255
    // Intensity & chorus heuristic using dual EMAs of total magnitude
    if (!(this as any)._intSlow) { (this as any)._intSlow = bass+mid+treb; (this as any)._intFast = bass+mid+treb }
    const cur = bass+mid+treb
    ;(this as any)._intFast += (cur - (this as any)._intFast) * (1 - Math.exp(-dt/0.08))
    ;(this as any)._intSlow += (cur - (this as any)._intSlow) * (1 - Math.exp(-dt/0.6))
    const intensity = (this as any)._intFast
    const chorus = (this as any)._intFast > (this as any)._intSlow * 1.35 && (this as any)._intFast > 0.9 * (this as any)._intSlow + 0.05
    // Basic beat phase estimation: we don't have precise beat timing here; approximate using bass envelope decay
    if (!(this as any)._beatPhase) (this as any)._beatPhase = 0
    if (beat) (this as any)._beatPhase = 0; else (this as any)._beatPhase = Math.min(1, (this as any)._beatPhase + dt * 2) // assume ~0.5s beat spacing fallback
    const beatPhase = (this as any)._beatPhase
    // Bar phase (approx 4 beats)
    if (!(this as any)._barPhase) (this as any)._barPhase = 0
    if (beat) (this as any)._barPhase = ((this as any)._barPhase + 1/4) % 1
    const barPhase = (this as any)._barPhase
    try {
      this.plugin.renderFrame({ fft: this.fftData, waveform: this.waveData, dt, time: now, beat, bass, mid, treb, intensity, beatPhase, barPhase, bpm: undefined, chorus })
    } catch (e) { console.warn('[viz] plugin frame error', e) }
    // Render (plugin may have already drawn; ensure final pass)
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.stop()
    if (this.plugin) { try { this.plugin.dispose() } catch {} this.plugin = null }
    if (this.resizeObserver && this.container) this.resizeObserver.unobserve(this.container)
    window.removeEventListener('resize', this.onWindowResize)
    if (this.renderer) { this.renderer.dispose(); this.renderer.domElement.remove() }
    this.scene = null; this.camera = null; this.renderer = null; this.analyser = null
    this.fftData = null; this.waveData = null
  }
}

export default VisualizationManager
