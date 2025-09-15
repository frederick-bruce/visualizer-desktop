import * as THREE from 'three'
import { VisualizationPlugin } from './types'

export const waveTunnel: VisualizationPlugin = (() => {
  let mesh: THREE.Mesh | null = null
  let material: THREE.MeshStandardMaterial | null = null
  let geometry: THREE.CylinderGeometry | null = null
  let basePositions: Float32Array | null = null

  return {
    async initialize(ctx) {
      geometry = new THREE.CylinderGeometry(1.2, 1.2, 12, 64, 160, true)
      basePositions = (geometry.getAttribute('position') as THREE.BufferAttribute).array.slice() as Float32Array
      material = new THREE.MeshStandardMaterial({ color: 0x4488ff, side: THREE.BackSide, metalness: 0.1, roughness: 0.7, transparent: true, opacity: 0.85 })
      mesh = new THREE.Mesh(geometry, material)
      mesh.rotation.x = Math.PI / 2
      ctx.scene.add(mesh)
      ctx.camera.position.set(0,0,0.5)
    },
    renderFrame({ waveform, dt, time }) {
      if (!mesh || !geometry || !basePositions) return
      const attr = geometry.getAttribute('position') as THREE.BufferAttribute
      const arr = attr.array as Float32Array
      // Distort radius using waveform sample mapping
      const samples = waveform.length
      for (let i=0;i<arr.length;i+=3) {
        const ix = i/3
        const norm = (ix % 64) / 64 // around circumference
        const sampleIndex = (norm * samples) | 0
        const amp = (waveform[sampleIndex] - 128) / 128 // -1..1
        const radialScale = 1 + amp * 0.25
        const bx = basePositions[i]
        const by = basePositions[i+1]
        const bz = basePositions[i+2]
        // expand relative to center in XY plane
        const r = Math.sqrt(bx*bx + bz*bz) || 1
        arr[i]   = bx / r * r * radialScale
        arr[i+1] = by
        arr[i+2] = bz / r * r * radialScale
      }
      attr.needsUpdate = true
      mesh.rotation.z += dt * 0.4
      if (material) {
        const hue = (time*0.03) % 1
        material.color.setHSL(hue, 0.6, 0.5)
        material.opacity = 0.6 + 0.25 * Math.sin(time*2)
      }
    },
    dispose() {
      if (mesh) {
        mesh.geometry.dispose()
        if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose())
        else mesh.material.dispose()
      }
      mesh = null
      material = null
      geometry = null
      basePositions = null
    }
  }
})()

export default waveTunnel
