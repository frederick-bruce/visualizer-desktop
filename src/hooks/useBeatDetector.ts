import { useEffect, useRef, useState, useCallback } from 'react'
import { getAnalyser } from '@/audio/getAnalyser'

type BeatState = { isBeat: boolean; intensity: number; ts: number }

interface BeatDetectorOptions { fftSize?: number; minBeatGapMs?: number; threshold?: number }

export function useBeatDetector(opts?: BeatDetectorOptions) {
  const { fftSize = 2048, minBeatGapMs = 140, threshold = 1.6 } = opts ?? {}
  const analyserRef = useRef<AnalyserNode | null>(null)
  const dataRef = useRef<Uint8Array | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastBeatTsRef = useRef(0)
  const emaRef = useRef(0)
  const runningRef = useRef(false)

  const [beat, setBeat] = useState<BeatState>({ isBeat: false, intensity: 0, ts: 0 })

  const ensureAnalyser = useCallback(async () => {
    if (analyserRef.current) return analyserRef.current
    const { analyser } = await getAnalyser()
    analyser.fftSize = fftSize
    analyser.smoothingTimeConstant = 0.8
    analyserRef.current = analyser
    dataRef.current = new Uint8Array(analyser.frequencyBinCount)
    return analyser
  }, [fftSize])

  const start = useCallback(async () => {
    if (runningRef.current) return
    const analyser = await ensureAnalyser()
    if (!analyser) return
    runningRef.current = true

    const loop = () => {
      if (!runningRef.current) return
      const a = analyserRef.current
      const buf = dataRef.current
      if (a && buf) {
  // Cast due to occasional DOM lib mismatch (Uint8Array<ArrayBufferLike> vs Uint8Array<ArrayBuffer>)
  (a as any).getByteFrequencyData(buf as any)
        // Bass band average (first ~32 bins)
        const lowEnd = Math.min(32, buf.length)
        let sum = 0
        for (let i = 0; i < lowEnd; i++) sum += buf[i]
        const avg = sum / lowEnd
        emaRef.current = emaRef.current === 0 ? avg : emaRef.current * 0.93 + avg * 0.07
        const ratio = emaRef.current ? avg / emaRef.current : 0
        const now = performance.now()
        const since = now - lastBeatTsRef.current
        const detected = ratio > threshold && since > minBeatGapMs
        if (detected) {
          lastBeatTsRef.current = now
          const intensity = Math.min(1, (ratio - threshold) / threshold)
          setBeat(prev => (prev.isBeat && now - prev.ts < 60 ? prev : { isBeat: true, intensity, ts: now }))
        } else if (beat.isBeat && now - beat.ts > 80) {
          setBeat(prev => (prev.isBeat ? { isBeat: false, intensity: 0, ts: now } : prev))
        }
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [ensureAnalyser, threshold, minBeatGapMs, beat.isBeat, beat.ts])

  const stop = useCallback(() => {
    runningRef.current = false
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }, [])

  useEffect(() => () => {
    stop()
    try { analyserRef.current?.disconnect() } catch {}
    analyserRef.current = null
    dataRef.current = null
  }, [stop])

  return { beat, start, stop }
}

export default useBeatDetector
