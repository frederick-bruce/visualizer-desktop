import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchAnalysis, makeCursor, type Analysis, type Timed, type Section } from '@/lib/spotify/analysis'
import { readState } from '@/lib/spotify/player'

export type VisualTick = {
  t: number
  onBeat: boolean
  onBar: boolean
  beatIdx: number
  barIdx: number
  bpm?: number
  tempo?: number
  section?: { start: number; duration: number; loudness: number; tempo: number; key: number; mode: number }
  beatProgress: number
  amplitude?: number
  bands?: { low: number; mid: number; high: number }
}

export function useSpotifySync(player: any) {
  const [trackId, setTrackId] = useState<string | null>(null)
  const analysisRef = useRef<Analysis | null>(null)
  const beatCursorRef = useRef<ReturnType<typeof makeCursor<Timed>> | null>(null)
  const barCursorRef = useRef<ReturnType<typeof makeCursor<Timed>> | null>(null)
  const tatumCursorRef = useRef<ReturnType<typeof makeCursor<Timed>> | null>(null)
  const sectionCursorRef = useRef<ReturnType<typeof makeCursor<Section>> | null>(null)
  const hasAnalysis = !!analysisRef.current
  const rafRef = useRef<number | null>(null)
  const listeners = useRef(new Set<(tick: VisualTick) => void>())

  // Poll SDK for track changes
  useEffect(() => {
    let cancelled = false
    let lastId: string | null = null
    let lastAnalysisAttempt = 0
    const poll = async () => {
      if (cancelled) return
      const s = await readState(player)
      const id = s?.trackId || null
      if (id && id !== lastId) {
        lastId = id; setTrackId(id)
        try {
          const now = performance.now()
          if (now - lastAnalysisAttempt < 3000) return // throttle
          lastAnalysisAttempt = now
          const a = await fetchAnalysis(id)
          if (!cancelled) {
            if (a) {
              analysisRef.current = a
              beatCursorRef.current = makeCursor(a.beats)
              barCursorRef.current = makeCursor(a.bars)
              tatumCursorRef.current = makeCursor(a.tatums)
              sectionCursorRef.current = makeCursor(a.sections)
            } else {
              // Analysis unavailable (403/404). We'll synthesize beats with a tempo heuristic.
              if (process.env.NODE_ENV !== 'production') console.info('[sync] analysis blocked or unavailable for track', id)
              analysisRef.current = null
              beatCursorRef.current = barCursorRef.current = tatumCursorRef.current = sectionCursorRef.current = null
            }
          }
        } catch (e: any) {
          analysisRef.current = null
          beatCursorRef.current = barCursorRef.current = tatumCursorRef.current = sectionCursorRef.current = null
        }
      }
    }
    const id = setInterval(poll, 500)
    poll()
    return () => { cancelled = true; clearInterval(id) }
  }, [player])

  // Deterministic synthetic bands generator
  const synthBands = useCallback((beatIdx: number, barIdx: number, tempo: number | undefined, beatProgress: number): { low: number; mid: number; high: number } => {
    const bpm = tempo ?? 120
    const phase = beatProgress
    // Low: pulse with beats
    const low = Math.max(0, Math.sin(Math.PI * Math.min(1, phase * 1.1)) ** 2)
    // Mid: undulate with bars
    const mid = 0.5 + 0.5 * Math.sin((barIdx % 8) / 8 * Math.PI * 2 + phase * Math.PI)
    // High: jitter with tatum-like granularity
    const high = 0.4 + 0.6 * Math.abs(Math.sin(phase * Math.PI * (bpm / 30)))
    return { low, mid, high }
  }, [])

  // rAF loop
  useEffect(() => {
    let stopped = false
    const loop = async () => {
      if (stopped) return
      try {
        const s = await readState(player)
        if (!s) { rafRef.current = requestAnimationFrame(loop); return }
        const tSec = s.position / 1000
        let beatRes = beatCursorRef.current ? beatCursorRef.current(tSec) : { index: -1, event: null }
        let barRes = barCursorRef.current ? barCursorRef.current(tSec) : { index: -1, event: null }
        const tatumRes = tatumCursorRef.current ? tatumCursorRef.current(tSec) : { index: -1, event: null }
        const sectionRes = sectionCursorRef.current ? sectionCursorRef.current(tSec) : { index: -1, event: null }
        const beat = beatRes.event
        const bar = barRes.event
        const section = sectionRes.event
        // If no analysis, synthesize a 120 BPM beat & 4/4 bars relative to track time
        let tempo = section?.tempo
        let onBeat = false
        let onBar = false
        let beatProgress = 0
        if (!beat && !analysisRef.current) {
          tempo = 120
          const beatDur = 60 / tempo
            const barDur = beatDur * 4
          const beatNumber = Math.floor(tSec / beatDur)
          const barNumber = Math.floor(tSec / barDur)
          const beatStart = beatNumber * beatDur
          beatProgress = (tSec - beatStart) / beatDur
          onBeat = (tSec - beatStart) < 0.05
          onBar = (beatNumber % 4 === 0) && onBeat
          beatRes = { index: beatNumber, event: { start: beatStart, duration: beatDur } }
          barRes = { index: barNumber, event: { start: barNumber * barDur, duration: barDur } }
        } else {
          onBeat = !!(beat && Math.abs(tSec - beat.start) <= 0.06)
          onBar = !!(bar && Math.abs(tSec - bar.start) <= 0.06)
          beatProgress = beat ? Math.max(0, Math.min(1, (tSec - beat.start) / Math.max(0.001, beat.duration))) : 0
        }
        const bpm = tempo
        // Amplitude from section loudness (-60..0 dB)
        const amp = section ? Math.max(0, Math.min(1, (section.loudness + 60) / 60)) : undefined
        const bands = synthBands(beatRes.index, barRes.index, bpm, beatProgress)
        const tick: VisualTick = { t: tSec, onBeat, onBar, beatIdx: beatRes.index, barIdx: barRes.index, bpm, tempo, section: section ? { start: section.start, duration: section.duration, loudness: section.loudness, tempo: section.tempo, key: section.key, mode: section.mode } : undefined, beatProgress, amplitude: amp, bands }
        listeners.current.forEach(cb => { try { cb(tick) } catch {} })
      } catch {}
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => { stopped = true; if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [player, synthBands])

  const onVisualTick = useCallback((cb: (tick: VisualTick) => void) => {
    listeners.current.add(cb)
    return () => listeners.current.delete(cb)
  }, [])

  return { trackId, hasAnalysis, onVisualTick }
}
