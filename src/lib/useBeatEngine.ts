import { useEffect, useRef, useState } from 'react'
import { Analysis } from '@/lib/spotifyApi'
import { usePlayerStore } from '@/store/player'

// ---- Types ----
export interface BeatFrame {
  t: number // song time (s)
  bpm: number
  beatPhase: number // 0..1
  barPhase: number // 0..1
  intensity: number // 0..1
  band: { low: number; mid: number; high: number }
  onBeat: boolean
  confidence: number
}

interface CachedAnalysis {
  beats: any[]
  bars: any[]
  tatums: any[]
  sections: any[]
  segments: any[]
  features?: any
}

const analysisCache = new Map<string, CachedAnalysis>()

// Helper to clamp
function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v }

// Find index via linear scan with cached last index (beats/bars are ordered & few thousand at most)
function locate(t: number, arr: any[], lastIdxRef: { current: number }) {
  let i = lastIdxRef.current
  if (i >= arr.length) i = arr.length - 1
  // Move forward
  while (i < arr.length - 1 && t >= arr[i].start + arr[i].duration) i++
  // Move backward (seek backwards)
  while (i > 0 && t < arr[i].start) i--
  lastIdxRef.current = i
  return i
}

// Simple exponential moving average update
function ema(current: number, target: number, dt: number, tau: number) {
  // alpha = dt / (tau + dt)
  const alpha = dt <= 0 ? 1 : dt / (tau + dt)
  return current + alpha * (target - current)
}

// Derive low/mid/high energy from a segment's pitches or timbre arrays (coarse approximation)
function bandsFromSegment(seg: any) {
  if (!seg) return { low: 0, mid: 0, high: 0 }
  const pitches: number[] = seg.pitches || []
  // If pitches missing fallback using timbre
  if (!pitches.length && seg.timbre) {
    // timbre length 12 too – normalize
    const tim: number[] = seg.timbre
    const norm = tim.map(v => (v + 80) / 120) // crude normalization
    return bandsFromPitches(norm)
  }
  return bandsFromPitches(pitches)
}

function bandsFromPitches(p: number[]) {
  if (!p.length) return { low: 0, mid: 0, high: 0 }
  const L = p.slice(0, 3)
  const M = p.slice(3, 7)
  const H = p.slice(7, 12)
  const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / (a.length || 1)
  return { low: clamp(avg(L), 0, 1), mid: clamp(avg(M), 0, 1), high: clamp(avg(H), 0, 1) }
}

// Attack-release envelope update (attack instant on beat, exponential-ish release)
function updateEnvelope(env: number, onBeat: boolean, dt: number, releaseMs: number) {
  if (onBeat) return 1
  const rel = Math.max(0.05, releaseMs / 1000)
  const decay = Math.exp(-dt / rel) // exponential decay towards 0
  return env * decay
}

export function useBeatEngine(trackId?: string | null) {
  // Select individually to avoid recreating an object every store mutation (which can spam renders)
  const progressMs = usePlayerStore(s => s.progressMs) as any
  const isPlaying = usePlayerStore(s => s.isPlaying) as any
  const vizSettings = usePlayerStore(s => s.vizSettings) as any
  const lowPowerMode = usePlayerStore(s => s.lowPowerMode) as any

  const [frame, setFrame] = useState<BeatFrame | null>(null)

  const analysisRef = useRef<CachedAnalysis | null>(null)
  const lastSyncReal = useRef(performance.now())
  const lastSyncSong = useRef(0) // ms
  const envRef = useRef(0)
  const beatIdxRef = useRef(0)
  const barIdxRef = useRef(0)
  const segmentIdxRef = useRef(0)
  const sectionIdxRef = useRef(0)
  const lastBeatHitTime = useRef<number>(-1)
  const rafRef = useRef<number | null>(null)
  const lastRenderReal = useRef(performance.now())

  // Fetch analysis when track changes
  useEffect(() => {
    if (!trackId) { analysisRef.current = null; return }
    let cancelled = false
    async function load() {
      const id = trackId as string
      if (analysisCache.has(id)) {
        analysisRef.current = analysisCache.get(id)!
        // Reset indices/env for new track
        envRef.current = 0
        beatIdxRef.current = 0
        barIdxRef.current = 0
        segmentIdxRef.current = 0
        sectionIdxRef.current = 0
        return
      }
      try {
        const [analysisRaw, features] = await Promise.all([
          Analysis.audioAnalysis(id),
          Analysis.audioFeatures(id)
        ])
        const analysis: any = analysisRaw as any
        if (cancelled) return
        const cached: CachedAnalysis = {
          beats: analysis.beats || [],
            bars: analysis.bars || [],
            tatums: analysis.tatums || [],
            sections: analysis.sections || [],
            segments: analysis.segments || [],
            features
        }
        analysisCache.set(id, cached)
        analysisRef.current = cached
        envRef.current = 0
        beatIdxRef.current = 0
        barIdxRef.current = 0
        segmentIdxRef.current = 0
        sectionIdxRef.current = 0
      } catch (e) {
        console.warn('BeatEngine analysis fetch failed', e)
        analysisRef.current = null
      }
    }
    load()
    return () => { cancelled = true }
  }, [trackId])

  // Sync song clock when store progress updates (phase lock)
  useEffect(() => {
    if (typeof progressMs !== 'number') return
    const now = performance.now()
    const predicted = lastSyncSong.current + (now - lastSyncReal.current)
    const drift = progressMs - predicted
    if (Math.abs(drift) > 120) {
      // Hard reset if large drift (seek)
      lastSyncSong.current = progressMs
      lastSyncReal.current = now
    } else {
      // Soft adjust: nudge baseline a small fraction of drift
      lastSyncSong.current += drift * 0.2
      lastSyncReal.current = now
    }
  }, [progressMs])

  // Main RAF loop
  useEffect(() => {
    let stopped = false
    function loop() {
      if (stopped) return
      const now = performance.now()
      const dtReal = (now - lastRenderReal.current) / 1000
      lastRenderReal.current = now
      const a = analysisRef.current
      // Compute song time (ms) using locked baseline
      let songMs = lastSyncSong.current
      if (isPlaying) songMs += (now - lastSyncReal.current)
      const songT = songMs / 1000

      if (a && a.beats.length) {
        // Locate current indices
        const bIdx = locate(songT, a.beats, beatIdxRef)
        const barIdx = locate(songT, a.bars, barIdxRef)
        const segIdx = locate(songT, a.segments, segmentIdxRef)
        const secIdx = locate(songT, a.sections, sectionIdxRef)
        const beat = a.beats[bIdx]
        const bar = a.bars[barIdx]
        const segment = a.segments[segIdx]
        const section = a.sections[secIdx]

        const beatPhase = beat ? clamp((songT - beat.start) / beat.duration, 0, 1) : 0
        const barPhase = bar ? clamp((songT - bar.start) / bar.duration, 0, 1) : 0
        const bpm = section?.tempo || a.features?.tempo || 120

        // OnBeat detection window ±35ms around beat start
        let onBeat = false
        if (beat) {
          const distMs = (songT - beat.start) * 1000
          if (Math.abs(distMs) < 35 && (lastBeatHitTime.current < beat.start)) {
            onBeat = true
            lastBeatHitTime.current = beat.start
          }
        }

        // Bands (EMA smoothing)
        const rawBands = bandsFromSegment(segment)
        const tau = 0.12 // seconds
        const prevFrame = frameRef.current
        const prevBands = prevFrame ? prevFrame.band : { low: 0, mid: 0, high: 0 }
        const low = ema(prevBands.low, rawBands.low, dtReal, tau)
        const mid = ema(prevBands.mid, rawBands.mid, dtReal, tau)
        const high = ema(prevBands.high, rawBands.high, dtReal, tau)

        // Envelope & intensity
        const releaseMs = vizSettings?.releaseMs ?? 250
        const beatSens = vizSettings?.beatSensitivity ?? 1
        envRef.current = updateEnvelope(envRef.current, onBeat, dtReal, releaseMs)
        const sectionLoud = section ? clamp(1 + (section.loudness || -60) / 60, 0, 1) : 0.5
        const baseEnergy = sectionLoud * 0.6 + mid * 0.4
        let intensity = clamp((baseEnergy * 0.7 + envRef.current * beatSens * 0.9), 0, 1)
        // Motion scale can amplify perceived intensity
        const motionScale = vizSettings?.motionScale ?? 1
        intensity = clamp(intensity * motionScale, 0, 1)

        const confidence = (beat?.confidence || 0.8) * 0.5 + (section?.confidence || 0.8) * 0.5

        const bf: BeatFrame = {
          t: songT,
          bpm,
          beatPhase,
          barPhase,
          intensity,
          band: { low, mid, high },
          onBeat,
          confidence: clamp(confidence, 0, 1)
        }
        frameRef.current = bf
        // Throttle to 30fps if low power
        if (!lowPowerMode || (now % 2 < 1)) {
          setFrame(bf)
        }
      } else {
        // Fallback (no analysis yet): simple pulsing sine mapped to intensity
        const t = songT
        const sine = 0.5 + 0.5 * Math.sin(t * 2)
        const intensity = clamp(sine, 0, 1)
        const bf: BeatFrame = {
          t, bpm: 120, beatPhase: sine, barPhase: (t % 4) / 4, intensity,
          band: { low: intensity * 0.7, mid: intensity, high: intensity * 0.5 },
          onBeat: false, confidence: 0
        }
        frameRef.current = bf
        if (!lowPowerMode || (now % 2 < 1)) setFrame(bf)
      }

      rafRef.current = requestAnimationFrame(loop)
    }
    const frameRef = { current: frame as BeatFrame | null } // local proxy for closure safety
    rafRef.current = requestAnimationFrame(loop)
    return () => { stopped = true; if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [isPlaying, vizSettings?.releaseMs, vizSettings?.beatSensitivity, vizSettings?.motionScale, lowPowerMode, trackId])

  return frame
}
