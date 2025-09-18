import { useEffect, useRef } from 'react'
import AudioAnalyzer from '@/analysis/AudioAnalyzer'
import { setAnalyzerFrame } from '@/analysis/analyzerBus'

export default function useLocalAudioAnalyzer(enabled: boolean, opts?: { deviceId?: string }) {
  const started = useRef(false)
  useEffect(() => {
    if (!enabled || started.current) return
    started.current = true
    const analyzer = new AudioAnalyzer()
    let unsub: (() => void) | null = null
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: opts?.deviceId || undefined } })
        await analyzer.connectFrom(stream)
        unsub = analyzer.subscribe(f => {
          setAnalyzerFrame({
            nowMs: f.nowMs ?? performance.now(),
            rms: f.rms,
            onset: f.onset,
            bands: f.bands,
            bass: f.bass,
            mid: f.mid,
            treble: f.treble,
            tempoBPM: f.tempoBPM ?? null,
          })
        })
      } catch (e) {
        console.warn('Local audio analyzer failed', e)
      }
    })()
    return () => { try { unsub && unsub() } catch {} }
  }, [enabled, opts?.deviceId])
}
