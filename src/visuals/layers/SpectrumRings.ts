import * as THREE from 'three'
import { ColorCycler } from '../color/palettes'
import type { StageLayer, StageFrame, LayerParams, ThreeStage } from '../ThreeStage'

export default class SpectrumRings implements StageLayer {
  id = 'SpectrumRings'
  private mesh: THREE.InstancedMesh | null = null
  private count = 96
  private radius = 2.6
  private cycler = new ColorCycler()
  private tmpMat = new THREE.Matrix4()
  private tmpVec = new THREE.Vector3()
  private tmpQuat = new THREE.Quaternion()
  private up = new THREE.Vector3(0,1,0)

  init(stage: ThreeStage) {
    const geom = new THREE.BoxGeometry(0.045, 1, 0.2)
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x000000, emissiveIntensity: 0.8, metalness: 0.0, roughness: 0.6, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    this.mesh = new THREE.InstancedMesh(geom, mat, this.count)
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    stage.scene.add(this.mesh)
  }

  setParams(p: Partial<LayerParams>) {
    if (typeof p['barCount'] === 'number') this.count = Math.max(16, Math.min(192, Math.floor(p['barCount'] as number)))
    if (typeof p['radius'] === 'number') this.radius = p['radius'] as number
  }

  setPerfMode(on: boolean) {
    if (this.mesh) this.mesh.count = on ? Math.min(this.count, 64) : this.count
  }

  render(frame: StageFrame) {
    const mesh = this.mesh; if (!mesh) return
    const bands = frame.bands || []
    const N = mesh.count
    const r = this.radius * (1 + ((frame.onset?0.08:0) + (frame.bass||0)*0.05))
    for (let i=0;i<N;i++) {
      const ang = (i / N) * Math.PI * 2
      const idx = Math.floor(Math.pow(i / N, 0.8) * (bands.length-1))
      const amp = bands.length ? (bands[idx] / 255) : (frame.rms ?? 0)
      const h = 0.25 + amp * 2.6
      this.tmpVec.set(Math.cos(ang)*r, 0, Math.sin(ang)*r)
      const dir = this.tmpVec.clone().normalize()
      const rotAxis = this.tmpQuat.setFromUnitVectors(this.up, dir)
      const scl = new THREE.Vector3(1, h, 1)
      this.tmpMat.compose(this.tmpVec, rotAxis, scl)
      mesh.setMatrixAt(i, this.tmpMat)
      // color
      const { color, boost } = this.cycler.sample(i/N, { low: frame.bass||0, mid: frame.mid||0, high: frame.treble||0, onset: frame.onset })
      const c = new THREE.Color().setRGB(color[0], color[1], color[2])
      const m = mesh.material as THREE.MeshStandardMaterial
      m.color.copy(c)
      m.emissive.copy(c).multiplyScalar(0.6 + boost)
    }
    mesh.instanceMatrix.needsUpdate = true
  }

  dispose() { if (this.mesh) { this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose() } }
}
