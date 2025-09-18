import ThreeStage from '../ThreeStage'
import MetaballNebula from '../layers/MetaballNebula'

export default function ChromaticStorm(stage: ThreeStage) {
  const neb = stage.registerLayer('MetaballNebula', new MetaballNebula(), { density: 0.6, noiseScale: 1.0 })
  return {
    id: 'chromatic-storm', name: 'Chromatic Storm',
    params: {
      density: { name: 'density', min: 0.2, max: 1.6, default: 0.7 },
      chromatic: { name: 'chromatic', min: 0, max: 1, default: 0.2 },
      noiseScale: { name: 'noiseScale', min: 0.2, max: 2.0, default: 1.0 },
    },
    onFrame(_p: Record<string, number>) {},
    setParams(p: any) { stage.setParams(neb.id, p) },
  }
}
