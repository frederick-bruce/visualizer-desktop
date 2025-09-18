import { useEffect } from 'react'
import { createFeatureBus } from '@/audio/FeatureBus'
import { createFromMic } from '@/audio/Sources'

export default function FeatureLog() {
  useEffect(() => {
    const bus = createFeatureBus(createFromMic())
    const off1 = bus.onSnapshot(f => {
      // Throttle logs
      if ((performance.now() % 250) < 16) {
        // eslint-disable-next-line no-console
        console.log('[feature]', { t: f.time.toFixed(2), rms: f.rms.toFixed(3), bpm: f.bpm, pitch: f.pitchHz?.toFixed(1), conf: f.pitchConf.toFixed(2) })
      }
    })
    const off2 = bus.onBeat(t => {
      // eslint-disable-next-line no-console
      console.log('[beat]', t.toFixed(2))
    })
    bus.start().catch(err => console.warn('FeatureBus start error', err))
    return () => { off1(); off2(); bus.stop() }
  }, [])

  return (
    <div className="p-4 text-xs text-white/70">
      <div className="mb-2">FeatureBus Demo</div>
      <div>Open console to see ~30–60 fps snapshots and BPM after a few seconds.</div>
    </div>
  )
}
