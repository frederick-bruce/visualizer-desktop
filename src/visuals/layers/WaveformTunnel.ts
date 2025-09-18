import * as THREE from 'three'
import type { StageLayer, StageFrame, LayerParams, ThreeStage } from '../ThreeStage'

export default class WaveformTunnel implements StageLayer {
  id = 'WaveformTunnel'
  private group: THREE.Group | null = null
  private mats: THREE.MeshBasicMaterial[] = []
  private depth = 160
  private segments = 64

  init(stage: ThreeStage) {
    this.group = new THREE.Group()
    stage.scene.add(this.group)
    for (let i=0;i<this.depth;i++) {
      const geo = new THREE.RingGeometry(0.6, 1.2, this.segments)
      const mat = new THREE.MeshBasicMaterial({ color: 0x55aaff, transparent: true, opacity: 0.24, depthWrite: false, blending: THREE.AdditiveBlending })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.z = -i * 0.2
      this.group.add(mesh)
      this.mats.push(mat)
    }
  }

  setPerfMode(on: boolean) { /* could reduce depth or segments if needed */ }
  setParams(p: Partial<LayerParams>) { if (typeof p['tunnelDepth']==='number') this.depth = Math.max(40, Math.floor(p['tunnelDepth'] as number)) }

  render(frame: StageFrame) {
    if (!this.group) return
    const n = this.group.children.length
    const bass = frame.bass ?? 0
    const rms = frame.rms ?? 0
    const bpm = frame.tempoBPM ?? 120
    const speed = 0.03 + (bpm/180)*0.07
    for (let i=0;i<n;i++) {
      const m = this.group.children[i] as THREE.Mesh
      const t = (i / n)
      const warp = Math.sin((t + frame.time*0.25) * Math.PI*2) * 0.12 * (0.6 + 0.4*(frame.mid||0))
      const s = 1 + warp + rms*0.4
      m.scale.setScalar(s)
      m.position.z += speed
      if (m.position.z > 0) m.position.z -= n * 0.2
      const alpha = 0.12 + 0.6*(1 - t)
      this.mats[i].opacity = Math.min(0.9, alpha)
    }
  }

  dispose() {}
}
