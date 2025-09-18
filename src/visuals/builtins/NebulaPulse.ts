import ThreeStage from '../ThreeStage'
import LiquidMesh from '../layers/LiquidMesh'
import OrbitingParticles from '../layers/OrbitingParticles'

export default function NebulaPulse(stage: ThreeStage) {
  const fluid = stage.registerLayer('LiquidMesh', new LiquidMesh(), {})
  const stars = stage.registerLayer('OrbitingParticles', new OrbitingParticles(), { starCount: 12000 })
  return {
    id: 'nebula-pulse', name: 'Nebula Pulse',
    params: {
      fluidity: { name: 'fluidity', min: 0, max: 1, default: 0.6 },
      pulse: { name: 'pulse', min: 0, max: 1, default: 0.5 },
      bloom: { name: 'bloom', min: 0, max: 1, default: 0.35 },
    },
    onFrame(_p: Record<string, number>) {},
    setParams(p: any) { /* hook up if needed */ },
  }
}
