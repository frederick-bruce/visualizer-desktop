import * as THREE from 'three'
import { BeatFrame, VizSettings } from '../engine'

export interface ParticlesScene {
  count: number
  update(frame: BeatFrame, settings: VizSettings, internalDt: number): void
  dispose(): void
}

export function createParticlesScene(scene: THREE.Scene, count: number): ParticlesScene {
  const positions = new Float32Array(count * 3)
  const rng = () => (Math.random()*2 - 1)
  for (let i=0;i<count;i++) {
    const i3 = i*3
    positions[i3] = rng()
    positions[i3+1] = rng()
    positions[i3+2] = rng()
  }
  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const material = new THREE.PointsMaterial({ size: 0.04, color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false })
  const points = new THREE.Points(geom, material)
  scene.add(points)

  let spread = 1
  let targetSpread = 1
  let beatPulse = 0

  function update(frame: BeatFrame, settings: VizSettings, internalDt: number) {
    if (frame.isBeat) beatPulse = 1; else beatPulse *= Math.exp(-internalDt / 0.25)
    targetSpread = 1 + settings.sensitivity * (frame.energyMid*0.8 + beatPulse*0.8)
    spread += (targetSpread - spread) * (1 - Math.exp(-internalDt / 0.15))
    const size = 0.04 * (1 + frame.energyHigh*1.2 + beatPulse*0.8) * (0.6 + settings.sensitivity*0.8)
    material.size = size
    material.opacity = 0.4 + frame.energyHigh*0.5 + beatPulse*0.3
    const rotSpeed = frame.bpm * 0.0009
    points.rotation.y += rotSpeed * internalDt
    points.rotation.x += rotSpeed * 0.25 * internalDt
    if ((frame.time*60|0) % 4 === 0) {
      const attr = geom.getAttribute('position') as THREE.BufferAttribute
      const arr = attr.array as Float32Array
      for (let i=0;i<arr.length;i+=3) {
        const x = arr[i]; const y = arr[i+1]; const z = arr[i+2]
        const scale = spread
        arr[i] = x/Math.max(1e-5, Math.abs(x)) * Math.abs(x) * scale
        arr[i+1] = y/Math.max(1e-5, Math.abs(y)) * Math.abs(y) * scale
        arr[i+2] = z/Math.max(1e-5, Math.abs(z)) * Math.abs(z) * scale
      }
      attr.needsUpdate = true
    }
  }

  function dispose() { geom.dispose(); material.dispose(); scene.remove(points) }

  return { count, update, dispose }
}
