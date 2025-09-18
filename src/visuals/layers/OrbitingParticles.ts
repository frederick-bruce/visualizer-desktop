import * as THREE from 'three'
import type { StageLayer, StageFrame, LayerParams, ThreeStage } from '../ThreeStage'

export default class OrbitingParticles implements StageLayer {
  id = 'OrbitingParticles'
  private points: THREE.Points | null = null
  private geom: THREE.BufferGeometry | null = null
  private vel: Float32Array | null = null
  private count = 20000
  private radius = 3
  private size = 0.02

  init(stage: ThreeStage) {
    const count = this.count
    const positions = new Float32Array(count * 3)
    const vel = new Float32Array(count)
    const rng = (min: number, max: number) => min + Math.random()*(max-min)
    for (let i=0;i<count;i++) {
      const a = Math.random() * Math.PI * 2
      const r = this.radius * (0.3 + Math.random()*0.7)
      positions[i*3+0] = Math.cos(a) * r
      positions[i*3+1] = rng(-0.8, 0.8)
      positions[i*3+2] = Math.sin(a) * r
      vel[i] = rng(0.2, 1.4)
    }
    this.vel = vel
    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({ color: 0x88ccff, size: this.size, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending })
    const pts = new THREE.Points(geom, mat)
    stage.scene.add(pts)
    this.points = pts
    this.geom = geom
  }

  setParams(p: Partial<LayerParams>) {
    if (typeof p['starCount'] === 'number') this.count = Math.max(1000, Math.floor(p['starCount'] as number))
  }
  setPerfMode(on: boolean) {
    if (!this.geom || !this.points) return
    const target = on ? Math.min(this.count, 20000) : this.count
    const attr = this.geom.getAttribute('position') as THREE.BufferAttribute
    const cur = (attr.array as Float32Array).length / 3
    if (cur !== target) {
      const positions = new Float32Array(target * 3)
      positions.set((attr.array as Float32Array).subarray(0, positions.length))
      this.geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      ;(this.points.material as THREE.PointsMaterial).size = on ? this.size*0.9 : this.size
    }
  }

  render(frame: StageFrame, _params: LayerParams, _clock: THREE.Clock) {
    if (!this.points || !this.geom || !this.vel) return
    const pos = this.geom.getAttribute('position') as THREE.BufferAttribute
    const arr = pos.array as Float32Array
    const N = Math.min(this.vel.length, arr.length/3)
    const centroid = frame.treble ?? 0
    const omega = 0.1 + centroid * 2.4
    const dt = frame.delta
    const beatScale = 1 + (frame.onset ? 0.05 : 0) + (frame.beatPhase ? (1 - frame.beatPhase) * 0.02 : 0)
    for (let i=0;i<N;i++) {
      const x = arr[i*3+0], z = arr[i*3+2]
      const r = Math.hypot(x, z) * beatScale
      const theta = Math.atan2(z, x) + omega * this.vel[i] * dt
      arr[i*3+0] = Math.cos(theta) * r
      arr[i*3+2] = Math.sin(theta) * r
    }
    pos.needsUpdate = true
  }

  dispose() { this.geom?.dispose(); (this.points?.material as THREE.Material | undefined)?.dispose() }
}
