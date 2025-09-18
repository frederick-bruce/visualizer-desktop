// analysis.worker: computes audio features using Meyda and YIN pitch detection
import Meyda from 'meyda'
import { YIN } from 'pitchfinder'

let yin: ReturnType<typeof YIN> | null = null

// Reusable buffers to avoid allocations inside onmessage
self.onmessage = (ev: MessageEvent<any>) => {
  const d = ev.data || {}
  if (d.type !== 'analyze') return
  const samples: Float32Array = d.samples
  const sampleRate: number = d.sampleRate
  const nyquist: number = d.nyquist || (sampleRate/2)

  try {
    if (!yin) yin = YIN({ sampleRate })
  } catch {}

  // Meyda expects an audio buffer or a frame + settings; we can pass the frame and specify features
  let rms = 0, centroid = 0
  let chroma: number[] = []
  let mfcc: number[] = []
  try {
    // Use simplified signature; cast to any to accommodate types in worker context
    const res: any = (Meyda as any).extract(['rms', 'spectralCentroid', 'chroma', 'mfcc'], samples as any, sampleRate)
    if (res) {
      rms = Number(res.rms) || 0
      const cHz = Number(res.spectralCentroid) || 0
      centroid = Math.max(0, Math.min(1, cHz / nyquist))
      chroma = Array.isArray(res.chroma) ? res.chroma : []
      mfcc = Array.isArray(res.mfcc) ? res.mfcc : []
    }
  } catch {}

  let pitchHz: number | null = null
  let pitchConf = 0
  try {
    if (yin) {
      const p: any = yin(samples as any)
      if (p && typeof p.freq === 'number' && typeof p.probability === 'number') {
        pitchHz = p.freq || null
        pitchConf = Math.max(0, Math.min(1, p.probability || 0))
      }
    }
  } catch {}

  ;(self as any).postMessage({ rms, centroid, chroma, mfcc, pitchHz, pitchConf })
}

export {} // ensure module
