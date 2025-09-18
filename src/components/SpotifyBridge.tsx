import { useEffect, useRef } from 'react'
import { usePlayerStore } from '@/store/player'
import { useVisualizerState } from '@/state/visualizerStore'
import { getCurrentlyPlayingETagged } from '@/lib/spotifyClient'
import { Analysis } from '@/lib/spotifyApi'
import { buildTimeline, intensityAt, bpmAt, computeBandAverages, Timeline } from '@/lib/beatmap'
import { getAnalyzerFrame } from '@/analysis/analyzerBus'

// Global, lightweight bridge that mirrors Spotify playback + analysis into the visualizer state
export default function SpotifyBridge() {
  // Do NOT subscribe to stores via hooks here to avoid re-render loops.
  // We'll use getState() and subscribe() selectively.
  const timelineRef = useRef<Timeline | null>(null)
  const currentTrackIdRef = useRef<string | null>(null)
  const lastBeatOnsetMs = useRef(0)
  const envRef = useRef({ rms: 0, bass: 0, mid: 0, treble: 0 })
  const rafRef = useRef<number | null>(null)

  // Mirror core playback info into HUD/state with a simple subscription + local diff
  useEffect(() => {
    let prev = usePlayerStore.getState()
    const unsub = usePlayerStore.subscribe((s: any) => {
      const changed = (
        s.isPlaying !== prev.isPlaying ||
        s.progressMs !== prev.progressMs ||
        s.durationMs !== prev.durationMs ||
        (s.track?.id !== prev.track?.id)
      )
      if (changed) {
        try {
          useVisualizerState.getState().setSpotify({
            isPlaying: s.isPlaying,
            positionMs: s.progressMs,
            durationMs: s.durationMs,
            track: s.track,
          })
          useVisualizerState.getState().setInactive(!s.isPlaying)
        } catch {}
        prev = s
      }
    }) as unknown as () => void
    return () => { try { unsub && unsub() } catch {} }
  }, [])

  // Track change → fetch audio analysis and build timeline
  useEffect(() => {
    let cancelled = false
    let lastTrackId: string | null = usePlayerStore.getState().track?.id || null
    const maybeFetch = async (trackId: string) => {
      if (cancelled) return
      if (!trackId) return
      if (trackId === currentTrackIdRef.current) return
      currentTrackIdRef.current = trackId
      try {
        const analysis = await Analysis.audioAnalysis(trackId)
        if (!cancelled) timelineRef.current = buildTimeline(analysis)
      } catch {
        if (!cancelled) timelineRef.current = null
      }
    }
    const unsub = usePlayerStore.subscribe((s: any) => {
      const id = s.track?.id || null
      if (id && id !== lastTrackId) {
        lastTrackId = id
        maybeFetch(id)
      }
    }) as unknown as () => void
    // also trigger once on mount
    if (lastTrackId) { maybeFetch(lastTrackId) }
    return () => { cancelled = true; try { unsub && unsub() } catch {} }
  }, [])

  // Fallback polling for current item when SDK events are stale/missing (e.g., external device)
  useEffect(() => {
    let stopped = false
    let t: any
    const tick = async () => {
      if (stopped) return
      try {
        const res = await getCurrentlyPlayingETagged()
        if (res?.status === 200 && res.body?.item?.id) {
          const id = res.body.item.id as string
          if (id !== currentTrackIdRef.current) {
            currentTrackIdRef.current = id
            try { const analysis = await Analysis.audioAnalysis(id); timelineRef.current = buildTimeline(analysis) } catch { timelineRef.current = null }
          }
        }
      } catch {}
      t = setTimeout(tick, 5000)
    }
    tick()
    return () => { stopped = true; if (t) clearTimeout(t) }
  }, [])

  // Frame loop: derive analysis frame from timeline + player progress
  useEffect(() => {
    let stopped = false
    const loop = () => {
      if (stopped) return
      try {
        const s = usePlayerStore.getState()
        const tl = timelineRef.current
        const nowMs = performance.now()
        // Compute time in seconds from store progress; when not available, approximate
        const posMs = s.progressMs ?? 0
        const tSec = (posMs / 1000)
  const tempo = tl ? bpmAt(tl, tSec) : null
        // derive rms from timeline and smooth
  const local = getAnalyzerFrame()
  const rawRmsTimeline = tl ? intensityAt(tl, tSec) : 0.6
  const rawRmsLocal = local?.rms
  const rawRms = rawRmsLocal != null ? (0.7 * rawRmsLocal + 0.3 * rawRmsTimeline) : rawRmsTimeline
        const env = envRef.current
        env.rms = env.rms + 0.2 * (rawRms - env.rms)
  const bands = local?.bands?.length ? local.bands : computeBandAverages(tSec, 32)
        // simple bass/mid/treble splits
        const bLen = bands.length
        const seg = Math.max(1, Math.floor(bLen/3))
  const bass = (local?.bass != null) ? local.bass : bands.slice(0, seg).reduce((a,b)=>a+b,0) / seg
  const mid = (local?.mid != null) ? local.mid : bands.slice(seg, seg*2).reduce((a,b)=>a+b,0) / seg
  const treble = (local?.treble != null) ? local.treble : bands.slice(seg*2).reduce((a,b)=>a+b,0) / Math.max(1, bLen - seg*2)
        env.bass = env.bass + 0.25 * (bass - env.bass)
        env.mid = env.mid + 0.25 * (mid - env.mid)
        env.treble = env.treble + 0.25 * (treble - env.treble)
        // beatPhase and onset from beats timeline
  let beatPhase: number | null = null
  let onset = !!local?.onset
        if (tl && tempo) {
          const idx = tl.beats.findIndex(b => tSec >= b.start && tSec < b.start + b.duration)
          if (idx >= 0) {
            const b = tl.beats[idx]
            beatPhase = (tSec - b.start) / b.duration
            if (beatPhase >= 0 && beatPhase < 0.06) {
              const refractory = 80 // ms
              if ((nowMs - lastBeatOnsetMs.current) > refractory) { onset = true; lastBeatOnsetMs.current = nowMs }
            }
          }
        }
        useVisualizerState.getState().setFrame({ nowMs, rms: env.rms, onset, tempoBPM: tempo, bands, beatPhase, bass: env.bass, mid: env.mid, treble: env.treble })
        useVisualizerState.getState().setInactive(!s.isPlaying)
      } catch {}
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => { stopped = true; if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  return null
}
