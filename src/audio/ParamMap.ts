import type { FeatureSnapshot } from '@/audio/FeatureBus'

export type MappedParams = {
  hue: number         // 0..360
  scale: number       // 0..1
  wobble: number      // 0..1
  gate: boolean       // beat/open gate
}

export function mapFeaturesToParams(f: FeatureSnapshot): MappedParams {
  const hue = (Math.max(0, Math.min(1, f.centroid)) * 300 + (f.chroma?.[0] || 0) * 60) % 360
  const scale = Math.max(0, Math.min(1, f.rms))
  const wobble = Math.max(0, Math.min(1, (f.pitchConf || 0) * 0.7 + (f.chroma?.[7] || 0) * 0.3))
  const gate = !!f.beatNow
  return { hue, scale, wobble, gate }
}
