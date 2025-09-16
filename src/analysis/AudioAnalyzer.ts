export type AnalyzerFrame = {
  rms: number
  spectralFlux: number
  onset: boolean
  tempoBPM?: number
  centroid: number
  bands: number[] // 32 length
  bass: number
  mid: number
  treble: number
}

export type AnalyzerSub = (f: AnalyzerFrame) => void

/**
 * Source-agnostic analyzer that connects to a MediaElementAudioSourceNode or MediaStreamAudioSourceNode
 * and feeds audio to an AudioWorkletProcessor for feature extraction at ~60fps. No heap churn in hot path.
 */
export class AudioAnalyzer {
  private ctx: AudioContext | null = null
  private workletNode: AudioWorkletNode | null = null
  private subs = new Set<AnalyzerSub>()

  async ensureWorklet(ctx?: AudioContext) {
    if (this.ctx && this.workletNode) return
    if (!this.ctx) this.ctx = ctx || new (window.AudioContext || (window as any).webkitAudioContext)()
    // Load worklet (served via Vite static import path)
    try {
      await this.ctx.audioWorklet.addModule('/src/analysis/audio-analyzer.worklet.js')
    } catch (e) {
      // Fallback: try relative path under base
      await this.ctx.audioWorklet.addModule('analysis/audio-analyzer.worklet.js')
    }
    this.workletNode = new AudioWorkletNode(this.ctx, 'audio-analyzer')
    this.workletNode.port.onmessage = (ev) => {
      const f = ev.data as AnalyzerFrame
      this.subs.forEach(cb => cb(f))
    }
  }

  async connectFrom(source: HTMLMediaElement | MediaStream): Promise<void> {
    await this.ensureWorklet()
    if (!this.ctx || !this.workletNode) throw new Error('worklet_not_ready')
    const ctx = this.ctx
    if (ctx.state === 'suspended') await ctx.resume()
    let srcNode: MediaElementAudioSourceNode | MediaStreamAudioSourceNode
    if (source instanceof HTMLMediaElement) {
      srcNode = ctx.createMediaElementSource(source)
    } else {
      srcNode = ctx.createMediaStreamSource(source)
    }
    // Connect source to worklet only (no output to speakers)
    srcNode.connect(this.workletNode)
  }

  async connectFromNode(node: AudioNode): Promise<void> {
    await this.ensureWorklet()
    if (!this.ctx || !this.workletNode) throw new Error('worklet_not_ready')
    const ctx = this.ctx
    if (ctx.state === 'suspended') await ctx.resume()
    node.connect(this.workletNode)
  }

  subscribe(cb: AnalyzerSub) { this.subs.add(cb); return () => this.subs.delete(cb) }

  dispose() {
    try { this.workletNode?.port.close() } catch {}
    try { this.workletNode?.disconnect() } catch {}
    try { this.ctx?.close() } catch {}
    this.workletNode = null
    this.ctx = null
    this.subs.clear()
  }

  getContext() { return this.ctx }
}

export default AudioAnalyzer
