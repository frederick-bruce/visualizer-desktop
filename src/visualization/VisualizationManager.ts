import { IVisualizationPlugin, VisualizationAudioFrame, VisualizationGraphicsContext, VisualizationPluginMeta, VisualizationPluginModule, PluginDiscoveryRecord } from './types'
import { createThreeGraphicsContext, createCanvas2DGraphicsContext } from './graphics/contexts'

// Manager responsible for discovering, loading, switching, and rendering visualization plugins.
export interface VisualizationManagerOptions {
  container?: HTMLElement
  preferredKind?: 'three' | 'canvas2d'
  lowPowerMode?: boolean
  targetFps?: number // used when lowPowerMode active
}

interface LoadedPlugin {
  instance: IVisualizationPlugin
  graphics: VisualizationGraphicsContext
}

export class VisualizationManager {
  private container: HTMLElement | null
  private options: VisualizationManagerOptions
  private discovered: PluginDiscoveryRecord[] = []
  private current: LoadedPlugin | null = null
  private currentId: string | null = null
  private rafId: number | null = null
  private lastTime = performance.now()/1000
  private frameCounter = 0

  constructor(opts: VisualizationManagerOptions = {}) {
    this.container = opts.container || null
    this.options = { targetFps: 30, ...opts }
  }

  // Discover plugins via Vite's eager glob (each plugin exports createPlugin)
  async discover(): Promise<VisualizationPluginMeta[]> {
    // Pattern: src/plugins/*/plugin.ts
    const modules = import.meta.glob('../plugins/*/plugin.ts') as Record<string, () => Promise<VisualizationPluginModule>>
    this.discovered = Object.entries(modules).map(([path, loader]) => ({ path, loader }))
    const metas: VisualizationPluginMeta[] = []
    for (const rec of this.discovered) {
      try {
        const mod = await rec.loader()
        const plugin = mod.createPlugin()
        metas.push(plugin.meta)
        // Immediate shutdown after probing meta
        plugin.shutdown()
      } catch (e) { console.warn('[viz] failed loading plugin meta', rec.path, e) }
    }
    return metas
  }

  setContainer(el: HTMLElement) { this.container = el; this.resize() }

  private createGraphics(kind: 'three' | 'canvas2d'): VisualizationGraphicsContext | null {
    if (kind === 'three') {
      try {
        const g = createThreeGraphicsContext()
        if (this.container) this.container.appendChild(g.canvas)
        return g
      } catch (e) { console.warn('[viz] three context failed, fallback canvas2d', e); return this.createGraphics('canvas2d') }
    }
    const g2d = createCanvas2DGraphicsContext()
    if (this.container) this.container.appendChild(g2d.canvas)
    return g2d
  }

  async loadPlugin(id: string): Promise<boolean> {
    if (this.currentId === id) return true
    const rec = this.discovered.find(r => r.path.includes(`/plugins/${id}/`))
    if (!rec) { console.warn('[viz] plugin not found', id); return false }
    await this.unloadCurrent()
    try {
      const mod = await rec.loader()
      const inst = mod.createPlugin()
      const graphics = this.createGraphics(inst.meta.kind)!
      await inst.initialize(graphics)
      this.current = { instance: inst, graphics }
      this.currentId = inst.meta.id
      this.lastTime = performance.now()/1000
      if (!this.rafId) this.loop()
      return true
    } catch (e) {
      console.error('[viz] failed to load plugin', id, e)
      await this.unloadCurrent()
      return false
    }
  }

  private async unloadCurrent() {
    if (this.current) {
      try { this.current.instance.shutdown() } catch {}
      // Remove canvas if present
      if (this.current.graphics.kind === 'three') {
        const g = this.current.graphics
        g.renderer.dispose()
        g.canvas.parentElement?.removeChild(g.canvas)
      } else if (this.current.graphics.kind === 'canvas2d') {
        this.current.graphics.canvas.parentElement?.removeChild(this.current.graphics.canvas)
      }
    }
    this.current = null
    this.currentId = null
  }

  private loop = () => {
    this.rafId = requestAnimationFrame(this.loop)
    if (!this.current) return
    const now = performance.now()/1000
    let dt = now - this.lastTime
    this.lastTime = now
    dt = Math.min(dt, 0.25)

    // Low power throttling
    if (this.options.lowPowerMode) {
      const target = this.options.targetFps || 30
      const skip = (this.frameCounter++ % Math.max(1, Math.round(60/target))) !== 0
      if (skip) return
    }

    if (this.pendingAudioFrame) {
      // Merge timing info with provided audio frame
      this.pendingAudioFrame.dt = dt
      this.pendingAudioFrame.time = now
      try { this.current.instance.renderFrame(this.pendingAudioFrame) } catch (e) { console.warn('[viz] plugin render error', e) }
    }
  }

  private pendingAudioFrame: VisualizationAudioFrame | null = null

  submitAudioFrame(frame: Omit<VisualizationAudioFrame, 'time' | 'dt'>) {
    // The manager owns time & dt to keep consistent timeline
    this.pendingAudioFrame = {
      ...frame,
      time: this.lastTime,
      dt: 0
    }
  }

  resize() {
    if (!this.container || !this.current) return
    const rect = this.container.getBoundingClientRect()
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    if (this.current.graphics.kind === 'three') {
      const g = this.current.graphics
      g.camera.aspect = rect.width / Math.max(1, rect.height)
      g.camera.updateProjectionMatrix()
      g.renderer.setPixelRatio(dpr)
      g.renderer.setSize(rect.width, rect.height, false)
    } else {
      const g = this.current.graphics
      const cw = Math.floor(rect.width * dpr)
      const ch = Math.floor(rect.height * dpr)
      if (g.canvas.width !== cw) { g.canvas.width = cw; g.canvas.style.width = rect.width + 'px' }
      if (g.canvas.height !== ch) { g.canvas.height = ch; g.canvas.style.height = rect.height + 'px' }
    }
    try { this.current.instance.resize?.(rect.width, rect.height, dpr) } catch {}
  }

  async destroy() {
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null }
    await this.unloadCurrent()
    this.discovered = []
  }
}
