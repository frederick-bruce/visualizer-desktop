import type { StageLayer, LayerParams } from '../ThreeStage'
import ThreeStage from '../ThreeStage'
import SpectrumRings from '../layers/SpectrumRings'

export default function ClassicBars(stage: ThreeStage) {
  const rings = stage.registerLayer('SpectrumRings', new SpectrumRings(), { barCount: 96, radius: 2.8 })
  return {
    id: 'classic-bars', name: 'Classic Bars',
    params: {
      barCount: { name: 'barCount', min: 32, max: 128, default: 96 },
      hueRate: { name: 'hueRate', min: 0, max: 1, default: 0.2 },
      glow: { name: 'glow', min: 0.4, max: 1.4, default: 0.9 },
      elastic: { name: 'elastic', min: 0, max: 1, default: 0.6 }
    } as Record<string, { name: string; min: number; max: number; default: number }>,
    onFrame(_p: Record<string, number>) {
      // layer reacts directly to analysis via stage.renderFrame inputs
    },
    setParams(p: Partial<LayerParams>) {
      stage.setParams(rings.id, p)
    },
  }
}
