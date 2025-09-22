import AnalysisWorker from '@/audio/workers/analysis.worker?worker'
import BeatWorker from '@/audio/workers/beat.worker?worker'
import type { AudioSourceFactory } from '@/audio/Sources'

export type FeatureSnapshot = {
  time: number
  rms: number
  centroid: number
  chroma: number[]
  mfcc: number[]
  pitchHz: number | null
  pitchConf: number
  bpm: number | null
  beatNow: boolean
}

export interface FeatureBus {
  start(): Promise<void>
  stop(): void
  onSnapshot(cb: (f: FeatureSnapshot) => void): () => void
  onBeat(cb: (t: number) => void): () => void
}

type Sub<T> = Set<T>

function ema(prev: number, next: number, alpha = 0.25) {
  return prev + alpha * (next - prev)
}

function softclip01(x: number) {
  // Map 0..inf to 0..1 smoothly; assume x>=0
  const y = x / (1 + x)
  return Math.max(0, Math.min(1, y))
}

export function createFeatureBus(makeSource: AudioSourceFactory, opts?: { enableBpm?: boolean }): FeatureBus {
  let ctx: AudioContext | null = null
  let sourceNode: AudioNode | null = null
  let cleanupSource: (() => void) | null = null

  let analyser: AnalyserNode | null = null
  let raf: number | null = null
  let running = false

  const analysisW = new AnalysisWorker()
  let beatW: InstanceType<typeof BeatWorker> | null = null

  // State
  let emaRms = 0
  let emaCent = 0
  let lastBeatAt = 0
  let bpm: number | null = null
  let cooldownUntil = 0

  // backpressure control
  const pending: number[] = []
  const MAX_QUEUE = 4

  const snapSubs: Sub<(f: FeatureSnapshot) => void> = new Set()
  const beatSubs: Sub<(t: number) => void> = new Set()

  const handleAnalysis = (ev: MessageEvent<any>) => {
    const d = ev.data || {}
    if (!ctx) return
    const t = ctx.currentTime
    emaRms = ema(emaRms, d.rms ?? 0.0, 0.2)
    emaCent = ema(emaCent, d.centroid ?? 0.0, 0.2)
    const rms = softclip01(emaRms)
    const centroid = Math.max(0, Math.min(1, emaCent))
    const chroma = Array.isArray(d.chroma) ? d.chroma : ([] as number[])
    const mfcc = Array.isArray(d.mfcc) ? d.mfcc : ([] as number[])
    const pitchHz = (typeof d.pitchHz === 'number') ? d.pitchHz : null
    const pitchConf = Math.max(0, Math.min(1, d.pitchConf ?? 0))

    // Simple onset → beat gate: if rms surges above EMA by threshold and cooldown passed
    let beatNow = false
    const nowMs = performance.now()
    const threshold = 0.08
    if ((d.rms ?? 0) - emaRms > threshold && nowMs > cooldownUntil) {
      beatNow = true
      lastBeatAt = t
      cooldownUntil = nowMs + 120 // ms refractory
      beatSubs.forEach(fn => { try { fn(t) } catch {} })
    }

    const snap: FeatureSnapshot = {
      time: t,
      rms,
      centroid,
      chroma,
      mfcc,
      pitchHz,
      pitchConf,
      bpm,
      beatNow
    }
    // Backpressure: drop late frames
    if (pending.push(1) > MAX_QUEUE) {
      // drop oldest by skipping emit
      pending.shift()
      return
    }
    queueMicrotask(() => {
      try { snapSubs.forEach(fn => fn(snap)) } finally { pending.shift() }
    })
  }

  const handleBeat = (ev: MessageEvent<any>) => {
    const d = ev.data || {}
    if (typeof d.bpm === 'number' && d.bpm > 0) {
      bpm = d.bpm
    }
  }

  analysisW.addEventListener('message', handleAnalysis)

  async function start() {
    if (running) return
    running = true
    // Create source
    const built = await makeSource()
    ctx = built.ctx
    sourceNode = built.sourceNode
    cleanupSource = built.cleanup
    // Analyser for time-domain capture
  analyser = (ctx as AudioContext).createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0
  ;(sourceNode as AudioNode).connect(analyser)
    // Pump loop
    const timeBuf = new Float32Array(analyser.fftSize)
  const sampleRate = (ctx as AudioContext).sampleRate
    const nyquist = sampleRate / 2
    const loop = () => {
      if (!running || !ctx || !analyser) return
      analyser.getFloatTimeDomainData(timeBuf)
      const t = ctx.currentTime
      // post to analysis worker
      analysisW.postMessage({ type: 'analyze', samples: timeBuf, sampleRate, nyquist }, [timeBuf.buffer.slice(0)])
      // feed beat worker with latest chunk (copy to avoid detaching timeBuf)
      if (opts?.enableBpm !== false) {
        if (!beatW) { beatW = new BeatWorker(); beatW.addEventListener('message', handleBeat) }
        const copy = new Float32Array(timeBuf)
        beatW.postMessage({ type: 'append', samples: copy, sampleRate }, [copy.buffer])
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
  }

  function stop() {
    running = false
    if (raf != null) cancelAnimationFrame(raf)
    raf = null
    try { analysisW.terminate() } catch {}
    try { beatW && beatW.terminate() } catch {}
    try { if (sourceNode) sourceNode.disconnect() } catch {}
    try { if (cleanupSource) cleanupSource() } catch {}
    sourceNode = null; analyser = null; ctx = null
    beatW = null
  }

  function onSnapshot(cb: (f: FeatureSnapshot) => void) {
    snapSubs.add(cb)
    return () => { snapSubs.delete(cb) }
  }

  function onBeat(cb: (t: number) => void) {
    beatSubs.add(cb)
    return () => { beatSubs.delete(cb) }
  }

  return { start, stop, onSnapshot, onBeat }
}
