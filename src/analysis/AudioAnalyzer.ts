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
  nowMs?: number
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
  // tempo/phase tracking
  private onsetTimes: number[] = [] // ms timestamps
  private bpmSmoothed: number | null = null
  private lastBeatAt: number | null = null
  private lastEveryN: Map<number, number> = new Map()

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
      // Update tempo/phase using onsets and timestamps
      if (f.onset) this.registerOnset(f.nowMs ?? performance.now())
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

  // --- Tempo / Phase helpers ---
  private registerOnset(tMs: number) {
    const arr = this.onsetTimes
    arr.push(tMs)
    if (arr.length > 64) arr.shift()
    // Compute IOIs
    if (arr.length >= 4) {
      const iois: number[] = []
      for (let i = 1; i < arr.length; i++) iois.push((arr[i] - arr[i - 1]) / 1000)
      // Autocorrelation-like histogram over plausible beat periods 0.25..2.0s
      const minP = 0.25, maxP = 2.0, step = 0.01
      let bestP = this.bpmSmoothed ? 60 / this.bpmSmoothed : 0.5
      let bestScore = -Infinity
      for (let p = minP; p <= maxP; p += step) {
        // score: sum of exp(-(d/p - round(d/p))^2 / 2sigma^2) aligning IOIs to multiples of p
        let s = 0
        for (const d of iois) {
          const k = Math.max(1, Math.round(d / p))
          const err = Math.abs(d - k * p) / p
          const sigma = 0.08
          s += Math.exp(-(err * err) / (2 * sigma * sigma))
        }
        if (s > bestScore) { bestScore = s; bestP = p }
      }
      const bpm = 60 / bestP
      this.bpmSmoothed = this.bpmSmoothed == null ? bpm : this.bpmSmoothed * 0.85 + bpm * 0.15
      this.lastBeatAt = tMs
    }
  }

  get bpm(): number | null { return this.bpmSmoothed }
  // 0..1 phase since last onset relative to current period estimate
  get beatPhase(): number {
    const now = performance.now()
    const last = this.lastBeatAt
    const bpm = this.bpmSmoothed
    if (!last || !bpm) return 0
    const periodMs = 60000 / bpm
    const ph = Math.max(0, (now - last) / periodMs)
    return Math.min(1, ph)
  }
  isDownbeat(eps = 0.08): boolean {
    const ph = this.beatPhase
    return ph < eps || (1 - ph) < eps
  }
  everyNBeats(n: number, eps = 0.08): boolean {
    const bpm = this.bpmSmoothed
    const last = this.lastBeatAt
    if (!bpm || !last || n <= 1) return this.isDownbeat(eps)
    const periodMs = (60000 / bpm) * n
    const now = performance.now()
    const lastTrig = this.lastEveryN.get(n) ?? 0
    const k = Math.round((now - last) / (periodMs))
    const target = last + k * periodMs
    if (Math.abs(now - target) <= eps * periodMs && Math.abs(target - lastTrig) > eps * periodMs) {
      this.lastEveryN.set(n, target)
      return true
    }
    return false
  }
  // quantize time in seconds to nearest division of current beat
  quantize(timeSec: number, div: '1/4' | '1/2' | '1' = '1/2'): number {
    const bpm = this.bpmSmoothed
    if (!bpm) return timeSec
    const beatSec = 60 / bpm
    const d = div === '1' ? 1 : div === '1/2' ? 0.5 : 0.25
    const grid = beatSec * d
    return Math.round(timeSec / grid) * grid
  }
}

export default AudioAnalyzer
