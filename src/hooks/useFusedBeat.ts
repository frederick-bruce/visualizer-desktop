import { useEffect, useRef } from 'react'
import { useBeatEngine } from '@/lib/useBeatEngine'
import useBeatDetector from '@/hooks/useBeatDetector'
import { useBeatStore } from '@/store/beat'
import { usePlayerStore } from '@/store/player'
import { useRealtimeTempo } from '@/hooks/useRealtimeTempo'

/**
 * Hook to fuse Spotify analysis beat (precise musical timing) with real-time spectral flux detector.
 * - Uses analysis for beat/bar phases & bpm
 * - Uses detector for immediate kick responsiveness / fallback when analysis unavailable
 * - Estimates latency between detector beats and analysis beats and stores latencyMs
 */
let fusedInstances = 0
export function useFusedBeat(trackId?: string | null) {
  const analysisFrame = useBeatEngine(trackId)
  const detector = useBeatDetector()
  // Realtime tempo fallback: enabled when analysisFrame absent (403 or still loading)
  const rtTempoRef = useRealtimeTempo(!analysisFrame)
  const setBeat = useBeatStore(s => s.set)
  const lastAnalysisBeat = useRef<number | null>(null)
  const lastDetectorBeat = useRef<number | null>(null)
  const latencyEMA = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const runningRef = useRef(false)
  const analysisRef = useRef<typeof analysisFrame | null>(analysisFrame)
  const detectorRef = useRef<typeof detector | null>(detector)
  const lastCommitRef = useRef({
    isBeat: false,
    beatIntensity: 0,
    beatPhase: 0,
    barPhase: 0,
    bpm: undefined as number | undefined,
    bass: undefined as number | undefined,
    mid: undefined as number | undefined,
    treb: undefined as number | undefined,
    t: 0
  })
  const updatingRef = useRef(false)

  analysisRef.current = analysisFrame
  detectorRef.current = detector

  useEffect(() => {
    fusedInstances++
    if (fusedInstances > 1) console.warn('[useFusedBeat] Multiple instances mounted; only first active.')
    runningRef.current = true

    const loop = () => {
      if (!runningRef.current) return
  const af = analysisRef.current
      const det = detectorRef.current
      const now = performance.now()
      let isBeat = false
      let source: 'analysis' | 'detector' | 'fused' = 'detector'
  // Realtime fallback snapshot
  const rt = !af ? rtTempoRef.current : null
  const beatPhase = af?.beatPhase ?? rt?.beatPhase ?? 0
  const barPhase = af?.barPhase ?? rt?.barPhase ?? 0
  const bpm = af?.bpm ?? rt?.bpm ?? undefined
      if (af?.onBeat) { isBeat = true; source = 'analysis'; lastAnalysisBeat.current = now }
      if (det?.beat.isBeat) { lastDetectorBeat.current = now; if (!isBeat) { isBeat = true; source = 'detector' } else source = 'fused' }
      if (lastAnalysisBeat.current && lastDetectorBeat.current) {
        const diff = lastAnalysisBeat.current - lastDetectorBeat.current
        if (latencyEMA.current == null) latencyEMA.current = diff
        latencyEMA.current += (diff - latencyEMA.current) * 0.1
      }
  const detectorIntensity = det?.beat.intensity ?? 0
  const analysisIntensity = af?.intensity ?? rt?.intensity ?? 0
      const beatIntensity = Math.min(1, detectorIntensity * 0.65 + analysisIntensity * 0.55)
  const bass = af?.band.low ?? rt?.bands.low
  const mid = af?.band.mid ?? rt?.bands.mid
  const treb = af?.band.high ?? rt?.bands.high
      const prev = useBeatStore.getState()
      // Throttle commits
      const lc = lastCommitRef.current
      const dtSince = now - lc.t
      const intensityDelta = Math.abs(lc.beatIntensity - beatIntensity)
      const beatEdge = isBeat && !lc.isBeat
      const phaseDrift = Math.abs(lc.beatPhase - beatPhase)
      const shouldCommit = beatEdge || intensityDelta > 0.02 || dtSince > 90 || phaseDrift > 0.25
      if (shouldCommit && !updatingRef.current) {
        updatingRef.current = true
        setBeat({
          isBeat,
          beatIntensity,
          beatPhase,
          barPhase,
          bpm,
          confidence: af?.confidence ?? prev.confidence,
          bass, mid, treb,
          source,
          lastBeatTime: isBeat ? now : prev.lastBeatTime,
          latencyMs: latencyEMA.current ?? prev.latencyMs
        })
        lastCommitRef.current = { isBeat, beatIntensity, beatPhase, barPhase, bpm, bass, mid, treb, t: now }
        updatingRef.current = false
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    if (fusedInstances === 1) { detector.start?.(); rafRef.current = requestAnimationFrame(loop) }
    return () => {
      runningRef.current = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      detector.stop?.()
      fusedInstances--
    }
  }, [])
}

export default useFusedBeat
