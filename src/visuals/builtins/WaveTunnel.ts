import ThreeStage from '../ThreeStage'
import WaveformTunnel from '../layers/WaveformTunnel'
import OrbitingParticles from '../layers/OrbitingParticles'

export default function WaveTunnel(stage: ThreeStage) {
  const tunnel = stage.registerLayer('WaveformTunnel', new WaveformTunnel(), { tunnelDepth: 160 })
  const stars = stage.registerLayer('OrbitingParticles', new OrbitingParticles(), { starCount: 8000 })
  return {
    id: 'wave-tunnel', name: 'Wave Tunnel',
    params: {
      tunnelDepth: { name: 'tunnelDepth', min: 60, max: 240, default: 160 },
      strobeAmt: { name: 'strobeAmt', min: 0, max: 1, default: 0.2 },
      fog: { name: 'fog', min: 0, max: 1, default: 0.1 },
    },
    onFrame(_p: Record<string, number>) {},
    setParams(p: any) { stage.setParams(tunnel.id, p); stage.setParams(stars.id, p) },
  }
}
