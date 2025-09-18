import ThreeStage from '../ThreeStage'
import OrbitingParticles from '../layers/OrbitingParticles'

export default function Starstream(stage: ThreeStage) {
  const stars = stage.registerLayer('OrbitingParticles', new OrbitingParticles(), { starCount: 50000 })
  return {
    id: 'starstream', name: 'Starstream',
    params: {
      trail: { name: 'trail', min: 0, max: 1, default: 0.6 },
      starCount: { name: 'starCount', min: 5000, max: 50000, default: 30000 },
      twinkle: { name: 'twinkle', min: 0, max: 1, default: 0.5 },
    },
    onFrame(_p: Record<string, number>) {},
    setParams(p: any) { stage.setParams(stars.id, p) },
  }
}
