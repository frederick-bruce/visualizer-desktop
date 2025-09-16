import * as THREE from 'three'
import { VisualizationPlugin } from './types'

// Instanced particle burst visualization
export const particleBurst: VisualizationPlugin = (() => {
  let mesh: THREE.InstancedMesh | null = null
  let velocities: Float32Array | null = null // per particle radial velocity
  let seeds: Float32Array | null = null // angle + plane tilt
  let hueBase = 0
  const tmpColor = new THREE.Color()
  const mat4 = new THREE.Matrix4()
  let lastBeatTime = 0

  return {
    async initialize(ctx) {
      const count = 3500
      const geo = new THREE.SphereGeometry(0.06, 6, 6)
      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x050505, roughness: 0.5, metalness: 0.1, transparent: true })
      mesh = new THREE.InstancedMesh(geo, mat, count)
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      velocities = new Float32Array(count)
      seeds = new Float32Array(count * 3)
      for (let i=0;i<count;i++) {
        velocities[i] = 0.2 + Math.random()*0.4
        const ang = Math.random()*Math.PI*2
        const elev = (Math.random()-0.5)*Math.PI*0.55
        const spin = (Math.random()*2-1)*0.5
        seeds.set([ang, elev, spin], i*3)
        const r = Math.random()*0.5
        const x = Math.cos(ang)*Math.cos(elev)*r
        const y = Math.sin(elev)*r
        const z = Math.sin(ang)*Math.cos(elev)*r
        mat4.setPosition(x,y,z)
        mesh.setMatrixAt(i, mat4)
        tmpColor.setHSL(Math.random(), 0.6, 0.45)
        mesh.setColorAt(i, tmpColor)
      }
      ctx.scene.add(mesh)
      ctx.camera.position.set(0,0,6)
    },
    renderFrame({ fft, dt, time, beat, bass, mid, treb, beatPhase, barPhase, intensity, chorus }) {
      if (!mesh || !velocities || !seeds) return
      const n = mesh.count
      // fallback band extraction if undefined
      if (bass === undefined || mid === undefined || treb === undefined) {
        const bassBins = fft.length*0.12|0
        let b=0, m=0, h=0
        for (let i=0;i<bassBins;i++) b += fft[i]
        const midStart = fft.length*0.12|0
        const midEnd = fft.length*0.55|0
        for (let i=midStart;i<midEnd;i++) m += fft[i]
        for (let i=midEnd;i<fft.length;i++) h += fft[i]
        bass = b/(bassBins||1)/255; mid = m/((midEnd-midStart)||1)/255; treb = h/((fft.length-midEnd)||1)/255
      }
      const high = treb ?? 0
      // Hue acceleration with high frequencies & chorus emphasis
      hueBase += dt * (0.1 + high*0.6 + (chorus?0.35:0))
      if (beat) lastBeatTime = time
      const localBeatPhase = beatPhase ?? Math.min(1, (time - lastBeatTime)/0.6)
      const beatPulse = beat ? 1 : Math.exp(-localBeatPhase*4)
      const chorusPulse = chorus ? 1 : 0
      const expansion = 1 + (bass||0)*1.5 + beatPulse*0.7 + chorusPulse*0.4
      const colorL = 0.35 + (bass||0)*0.35 + beatPulse*0.25 + chorusPulse*0.15

      const mat = mesh.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.25 + high*0.9 + beatPulse*0.8 + chorusPulse*0.6
      mat.opacity = 0.55 + 0.35*beatPulse + 0.2*chorusPulse

      for (let i=0;i<n;i++) {
        const baseVel = velocities[i]
        const ang = seeds[i*3]
        const elev = seeds[i*3+1]
        const spin = seeds[i*3+2]
        // radial distance evolves with bass + base velocity; add barPhase macro breathing and chorus shockwave
        const barMod = barPhase !== undefined ? (0.85 + 0.15*Math.sin(barPhase*Math.PI*2)) : 1
        const r = (0.4 + baseVel*time*0.15) * expansion * barMod * (0.9 + 0.1*Math.sin(time*spin + i*0.1))
        const wobble = 0.03 + high*0.06 + (chorus?0.02:0)
        const micro = 0.02 * (0.5 + 0.5*Math.sin((localBeatPhase*Math.PI*2) + i*0.3))
        const x = Math.cos(ang + time*spin*0.4)*Math.cos(elev)*r + Math.sin(time*2 + i)*wobble
        const y = Math.sin(elev)*r + Math.cos(time*1.4 + i*0.5)*wobble + micro
        const z = Math.sin(ang + time*spin*0.4)*Math.cos(elev)*r + Math.cos(time*2.2 + i)*wobble
        mat4.setPosition(x,y,z)
        mesh.setMatrixAt(i, mat4)
        tmpColor.setHSL((hueBase + (i/n) + (mid||0)*0.25 + chorusPulse*0.1) % 1, 0.55 + high*0.35 + chorusPulse*0.2, colorL)
        mesh.setColorAt(i, tmpColor)
      }
      mesh.instanceMatrix.needsUpdate = true
      if ((mesh as any).instanceColor) (mesh as any).instanceColor.needsUpdate = true
    },
    dispose() {
      if (mesh) {
        mesh.geometry.dispose()
        if (Array.isArray(mesh.material)) mesh.material.forEach(m=>m.dispose())
        else mesh.material.dispose()
      }
      mesh = null; velocities = null; seeds = null
    }
  }
})()

export default particleBurst