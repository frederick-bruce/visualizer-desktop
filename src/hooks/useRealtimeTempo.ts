import { useEffect, useRef } from 'react'
import { getAnalyser } from '@/audio/getAnalyser'

/**
 * Real-time tempo + phase estimator using adaptive inter-beat interval clustering.
 * Works purely from low-frequency energy bursts (kick / bass) so it functions when Spotify analysis is unavailable (403).
 *
 * Algorithm outline:
 * 1. Smooth bass band energy via moving average (emaFast / emaSlow) to get a flux-like measure (diff = fast - slow).
 * 2. Detect onsets when diff crosses dynamic threshold (median + k * MAD) with refractory period.
 * 3. Maintain last N inter-onset intervals (IOIs). Cluster by grouping within +/-8%.
 * 4. Pick dominant cluster's average IOI -> tempo (bpm = 60 / IOI_sec). Stabilize with exponential smoothing.
 * 5. Derive beatPhase by measuring time since last onset divided by current period (wrapped 0..1). BarPhase created by grouping 4 beats.
 * 6. Provide intensity (recent diff normalized) & basic low/mid/high bands from spectrum for visual richness.
 */
export interface RealtimeTempoState {
  bpm: number | null
  beatPhase: number
  barPhase: number
  isBeat: boolean
  intensity: number
  bands: { low: number; mid: number; high: number }
}

export function useRealtimeTempo(enabled: boolean) {
  const stateRef = useRef<RealtimeTempoState>({ bpm: null, beatPhase: 0, barPhase: 0, isBeat: false, intensity: 0, bands: { low: 0, mid: 0, high: 0 } })
  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataRef = useRef<Uint8Array | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastOnsets = useRef<number[]>([])
  const lastBeatTime = useRef<number | null>(null)
  const bpmRef = useRef<number | null>(null)
  const emaFast = useRef(0)
  const emaSlow = useRef(0)
  const lastTrigger = useRef(0)
  const lastIsBeat = useRef(false)

  useEffect(() => {
    if (!enabled) return
    let didCancel = false
    ;(async () => {
      const { analyser } = await getAnalyser()
      if (didCancel) return
      analyser.fftSize = 1024
      analyser.smoothingTimeConstant = 0.7
      analyserRef.current = analyser
      dataRef.current = new Uint8Array(analyser.frequencyBinCount)
      loop()
    })()
    function loop() {
      if (didCancel) return
      const a = analyserRef.current
      const buf = dataRef.current
      if (a && buf) {
  // Cast due to DOM lib variance between Uint8Array<ArrayBufferLike> vs Uint8Array<ArrayBuffer>
  (a as any).getByteFrequencyData(buf as any)
        // Bass = first 32 bins; mid next 96; high remainder simplified
        const L = 32, M = 96
        let sumL = 0, sumM = 0, sumH = 0
        for (let i=0;i<buf.length;i++) {
          const v = buf[i]
          if (i < L) sumL += v; else if (i < L+M) sumM += v; else sumH += v
        }
        const low = sumL / L / 255
        const mid = sumM / M / 255
        const high = sumH / Math.max(1, buf.length - (L+M)) / 255
        const energy = sumL / L
        emaFast.current = emaFast.current === 0 ? energy : emaFast.current * 0.6 + energy * 0.4
        emaSlow.current = emaSlow.current === 0 ? energy : emaSlow.current * 0.92 + energy * 0.08
        const diff = Math.max(0, emaFast.current - emaSlow.current)
        // Dynamic threshold using short history of diffs
        thresholdHistory.push(diff)
        if (thresholdHistory.length > 120) thresholdHistory.shift()
        const med = median(thresholdHistory)
        const mad = median(thresholdHistory.map(d => Math.abs(d - med))) || 1
        const dynThresh = med + mad * 2.2
        const now = performance.now()
        let isBeat = false
        if (diff > dynThresh && (now - lastTrigger.current) > 130) {
          isBeat = true
          lastTrigger.current = now
          // Record onset
          if (lastBeatTime.current != null) {
            const ioi = (now - lastBeatTime.current) / 1000
            if (ioi > 0.18 && ioi < 2.5) { // plausible 24-333 BPM
              lastOnsets.current.push(ioi)
              if (lastOnsets.current.length > 24) lastOnsets.current.shift()
              const clustered = clusterIOIs(lastOnsets.current)
              const dominant = clustered[0]
              if (dominant) {
                const period = dominant.avg
                const targetBpm = 60 / period
                bpmRef.current = bpmRef.current == null ? targetBpm : bpmRef.current * 0.85 + targetBpm * 0.15
              }
            }
          }
          lastBeatTime.current = now
        }
        // Phase calculations
        let beatPhase = 0
        if (lastBeatTime.current) {
          const period = bpmRef.current ? 60 / bpmRef.current : (lastOnsets.current.slice(-1)[0] || 0.5)
          beatPhase = Math.min(1, (now - lastBeatTime.current) / (period * 1000))
        }
        const bpm = bpmRef.current || null
        const barPeriod = (bpm ? (60 / bpm) : (lastOnsets.current.slice(-1)[0] || 0.5)) * 4
        const barPhase = lastBeatTime.current ? Math.min(1, (now - (lastBeatTime.current - (beatPhase * (bpm ? (60 / bpm) : (lastOnsets.current.slice(-1)[0] || 0.5))) )) / (barPeriod*1000)) % 1 : beatPhase
        const intensity = Math.min(1, diff / (dynThresh * 1.5))
        stateRef.current = { bpm, beatPhase, barPhase, isBeat, intensity, bands: { low, mid, high } }
        lastIsBeat.current = isBeat
      }
      rafRef.current = requestAnimationFrame(loop)
    }
     return () => { didCancel = true; if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [enabled])
  return stateRef
}

// Utilities
const thresholdHistory: number[] = []
function median(list: number[]) {
  if (!list.length) return 0
  const s = [...list].sort((a,b)=>a-b)
  const m = Math.floor(s.length/2)
  return s.length % 2 ? s[m] : (s[m-1]+s[m])/2
}

interface Cluster { avg: number; count: number }
function clusterIOIs(iois: number[]): Cluster[] {
  const clusters: Cluster[] = []
  for (const v of iois) {
    let placed = false
    for (const c of clusters) {
      if (Math.abs(c.avg - v) / c.avg < 0.08) { // within 8%
        c.avg = (c.avg * c.count + v) / (c.count + 1)
        c.count++
        placed = true
        break
      }
    }
    if (!placed) clusters.push({ avg: v, count: 1 })
  }
  return clusters.sort((a,b)=>b.count-a.count)
}

export default useRealtimeTempo