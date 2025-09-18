import ThreeStage from '../ThreeStage'
import SonarRipples from '../layers/SonarRipples'
import LiquidMesh from '../layers/LiquidMesh'

export default function SonarField(stage: ThreeStage) {
  const rip = stage.registerLayer('SonarRipples', new SonarRipples(), { rippleSpeed: 1, decay: 0.94 })
  const bg = stage.registerLayer('LiquidMesh', new LiquidMesh(), {})
  return {
    id: 'sonar-field', name: 'Sonar Field',
    params: {
      rippleSpeed: { name: 'rippleSpeed', min: 0.3, max: 2.0, default: 1.0 },
      decay: { name: 'decay', min: 0.88, max: 0.98, default: 0.94 },
      contrast: { name: 'contrast', min: 0, max: 1, default: 0.5 },
    },
    onFrame(_p: Record<string, number>) {},
    setParams(p: any) { stage.setParams(rip.id, p) },
  }
}
